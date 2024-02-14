import EventEmitter from 'events'
import { WebSocket } from 'ws'

export type Packet = {
    type: string
    data: unknown
}

export type WebSocketOptions = {
    autoReconnect?: boolean
    reconnectDelayMS?: number
    reconnectAttempts?: number

    timeoutMS?: number
}

export class WebSocketError extends Error {
    constructor(public readonly message: string) {
        super(message)
    }
}

export interface WebSocketClient {
    on(event: 'open', listener: () => void): this
    on(event: 'config', listener: (config: unknown) => void): this
    on(event: 'close', listener: (reason: string) => void): this
}

export class WebSocketClient extends EventEmitter {
    private ws: WebSocket | null = null

    // state stuff
    private receivedHello = false
    private heartbeatTimeout: NodeJS.Timeout | null = null

    constructor(
        private readonly websocketURL: string,
        private readonly authToken: string,
        private readonly options: WebSocketOptions = {},
    ) {
        super()
    }

    private resetState() {
        this.receivedHello = false
        this.heartbeatTimeout = null
    }

    connect(reconnectCount = 0) {
        this.ws = new WebSocket(this.websocketURL)

        this.resetState()

        const timeout = setTimeout(() => {
            if (this.ws!.readyState === WebSocket.CONNECTING) {
                this.stop()
                this.emit('close', 'timeout')
                throw new WebSocketError('Connection timed out')
            }
        }, this.options.timeoutMS || 5000)

        this.ws.on('open', () => {
            // reset the reconnect count upon successful connection
            reconnectCount = 0

            // immediately upon connection, send the identify packet
            this.sendPacket('identify', { token: this.authToken })
            this.emit('open')

            clearTimeout(timeout)
        })

        this.ws.on('message', data => {
            let packet: Packet
            try {
                packet = JSON.parse(data.toString())

                if (typeof packet.type !== 'string') {
                    throw new WebSocketError(
                        'Packet features invalid data, if the servers updated the protocol, please update the client',
                    )
                }
            } catch (err) {
                this.stop()
                throw new WebSocketError('Failed to parse packet: ' + err)
            }

            this.handlePacket(packet)
        })

        const onClose = () => {
            // if we have a close reason, it means that the connection was closed by the server
            this.emit('close', 'error')

            // we do not need any listeners anymore, in fact they will only cause issues
            this.ws!.removeAllListeners()

            const maxAttempts = this.options.reconnectAttempts ?? 5
            const exceededMaxReconnectAttempts =
                maxAttempts > 0 && reconnectCount >= maxAttempts

            if (
                !(this.options.autoReconnect ?? true) ||
                exceededMaxReconnectAttempts
            ) {
                throw new WebSocketError('Exceeded max reconnect attempts')
            }

            setTimeout(
                () => this.connect(reconnectCount + 1),
                this.options.reconnectDelayMS || 5000,
            )
        }

        this.ws.on('error', onClose)
        this.ws.on('close', onClose)
    }

    private handlePacket(packet: Packet) {
        switch (packet.type) {
            case 'error':
                throw new WebSocketError(
                    'Received error packet: ' + packet.data,
                )
            case 'invalidate':
                this.stop()
                throw new WebSocketError(
                    `Received invalidate packet: ${packet.data}, please reconnect with your new token`,
                )
            case 'hello':
                // we only want to start the heartbeat once
                if (this.receivedHello) {
                    break
                }

                if (
                    !packet.data ||
                    typeof packet.data !== 'object' ||
                    !('heartbeatIntervalMS' in packet.data)
                ) {
                    this.stop()
                    throw new WebSocketError(
                        'Received invalid hello packet, please update the client',
                    )
                }
                this.heartbeat(packet.data.heartbeatIntervalMS as number)
                this.receivedHello = true
                break
            case 'config':
                if (
                    !packet.data ||
                    typeof packet.data !== 'object' ||
                    !('config' in packet.data)
                ) {
                    this.stop()
                    throw new WebSocketError(
                        'Received invalid config packet, please update the client',
                    )
                }

                this.emit('config', packet.data.config)
                break
            case 'heartbeat':
                break // there's nothing to be done in response to a heartbeat (yet)
            default:
                this.stop()
                throw new WebSocketError(
                    `Received unknown packet type: ${packet.type}, please update the client`,
                )
        }
    }

    private heartbeat(heartbeatIntervalMS: number) {
        if (!this.ws) {
            return // we don't need to throw an error, we can just assume that the connection is closed
        }

        setTimeout(() => {
            // send with an empty object because that is what's required by the server
            this.sendPacket('heartbeat', {})
            this.heartbeat(heartbeatIntervalMS)
        }, heartbeatIntervalMS)
    }

    private sendPacket(type: string, data: unknown) {
        if (!this.ws) {
            throw new Error('WebSocket is not connected')
        }

        this.ws.send(JSON.stringify({ type, data }))
    }

    stop() {
        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout)

        if (this.ws) {
            this.ws.close()
        }
    }
}
