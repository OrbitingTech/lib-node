import EventEmitter from 'events'
import { WebSocket } from 'ws'

import { websocketLog } from './logger.js'

export type Packet = {
    type: string
    data: unknown
}

export type WebSocketOptions = {
    reconnectDelayMS?: number
    reconnectAttempts?: number

    timeoutMS?: number
}

export class WebSocketError extends Error {
    name = 'WebSocketError'

    constructor(public readonly message: string) {
        super(message)
    }
}

export declare interface WebSocketClient {
    on(event: 'open', listener: () => void): this
    on(event: 'config', listener: (config: unknown) => void): this
    on(event: 'close', listener: (err?: Error) => void): this
}

export class WebSocketClient extends EventEmitter {
    private ws: WebSocket | null = null

    // state stuff
    private receivedHello = false
    private heartbeatTimeout: NodeJS.Timeout | null = null

    private closeError: Error | null = null
    private selfClose = false

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

        this.closeError = null
        this.selfClose = false
    }

    connect(reconnectCount = 0) {
        this.ws = new WebSocket(this.websocketURL)

        this.resetState()

        const timeout = setTimeout(() => {
            websocketLog('Connection timed out')

            if (this.ws!.readyState === WebSocket.CONNECTING) {
                this.close()
                this.emit('close', new WebSocketError('Connection timed out'))
            }
        }, this.options.timeoutMS || 5000)

        this.ws.on('open', () => {
            websocketLog('Connected to websocket server')

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
                this.close(err as Error)
                return
            }

            this.handlePacket(packet)
        })

        const onClose = () => {
            websocketLog('Connection closed')

            // we do not need any listeners anymore, in fact they will only cause issues
            this.ws!.removeAllListeners()
            clearTimeout(timeout)

            if (this.selfClose) {
                this.emit('close', this.closeError)
                return
            }

            const maxAttempts = this.options.reconnectAttempts ?? 5
            const exceededMaxReconnectAttempts =
                maxAttempts >= 0 && reconnectCount >= maxAttempts

            // when we exceed the max attempts we should finally emit a close event
            if (exceededMaxReconnectAttempts) {
                this.emit(
                    'close',
                    new WebSocketError('Exceeded max reconnect attempts'),
                )
                return
            }

            websocketLog(
                'Attempting to reconnect:',
                reconnectCount + 1,
                'of',
                maxAttempts,
            )

            setTimeout(
                () => this.connect(reconnectCount + 1),
                this.options.reconnectDelayMS || 5000,
            )
        }

        this.ws.on('error', onClose)
        this.ws.on('close', onClose)
    }

    private handlePacket(packet: Packet) {
        websocketLog('Received packet:', packet.type, packet.data)

        switch (packet.type) {
            case 'error':
                this.close(
                    new WebSocketError('Received error packet: ' + packet.data),
                )
                break
            case 'invalidate':
                this.close(
                    new WebSocketError(
                        `Received invalidate packet: ${packet.data}, please reconnect with your new token`,
                    ),
                )
                break
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
                    this.close(
                        new WebSocketError(
                            'Received invalid hello packet, please update the client',
                        ),
                    )
                    break
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
                    this.close(
                        new WebSocketError(
                            'Received invalid config packet, please update the client',
                        ),
                    )
                    break
                }

                this.emit('config', packet.data.config)
                break
            case 'heartbeat':
                break // there's nothing to be done in response to a heartbeat (yet)
            default:
                this.close(
                    new WebSocketError(
                        `Received unknown packet type: ${packet.type}, please update the client`,
                    ),
                )
                break
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
            throw new WebSocketError('WebSocket is not connected')
        }

        websocketLog('Sending packet:', type, data)

        this.ws.send(JSON.stringify({ type, data }))
    }

    close(error: Error | null = null) {
        this.closeError = error

        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout)

        if (this.ws) {
            this.ws.close()
        }
    }
}
