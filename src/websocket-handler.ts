import type { OrbitingClient } from './orbiting-client.js'
import type { ObjectProperties } from './types/schema.js'
import type { RawData } from 'ws'

import { WebSocket } from 'ws'

import { WebSocketError } from './errors.js'
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

export class WebSocketClient<Schema extends ObjectProperties> {
    private ws: WebSocket | null = null

    private attemptedReconnectCount = 0

    // state stuff
    private receivedHello = false

    private connectionTimeout: NodeJS.Timeout | null = null
    private heartbeatTimeout: NodeJS.Timeout | null = null

    private closeError: Error | null = null
    private selfClose = false

    constructor(
        private readonly orbitingClient: OrbitingClient<Schema>,
        private readonly websocketURL: string,
        private readonly authToken: string,
        private readonly options: WebSocketOptions = {},
    ) {}

    private resetState() {
        this.attemptedReconnectCount = 0

        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout)
            this.heartbeatTimeout = null
        }

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
        }

        this.receivedHello = false

        this.closeError = null
        this.selfClose = false
    }

    connect() {
        this.resetState()

        this.ws = new WebSocket(this.websocketURL, {})

        this.connectionTimeout = setTimeout(() => {
            websocketLog('Connection timed out')

            if (this.ws!.readyState === WebSocket.CONNECTING) {
                this.close(new WebSocketError('Connection timed out'))
            }
        }, this.options.timeoutMS || 5000)

        this.ws.on('open', this.onWebsocketOpen.bind(this))
        this.ws.on('message', this.onWebsocketMessage.bind(this))

        this.ws.on('error', this.onWebsocketClose.bind(this))
        this.ws.on('close', this.onWebsocketClose.bind(this))
    }

    private onWebsocketOpen() {
        websocketLog('Connected to websocket server')

        // reset the reconnect count upon successful connection
        this.attemptedReconnectCount = 0

        // immediately upon connection, send the identify packet
        this.sendPacket('identify', { token: this.authToken })

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
        }
    }

    private onWebsocketMessage(data: RawData) {
        let packet: Packet
        try {
            packet = JSON.parse(data.toString())

            if (typeof packet.type !== 'string') {
                throw new WebSocketError(
                    'Packet features invalid data, if the servers updated the protocol, please update the client',
                )
            }

            this.handlePacket(packet)
        } catch (err) {
            this.close(err as Error)
        }
    }

    private onWebsocketClose(error?: Error) {
        websocketLog('Connection closed')

        // we do not need any listeners anymore, in fact they will only cause issues
        this.ws!.removeAllListeners()

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
        }

        if (error || this.closeError) {
            this.orbitingClient.emit('error', error || this.closeError)
        }

        if (this.selfClose) {
            return
        }

        const maxAttempts = this.options.reconnectAttempts ?? 5
        const exceededMaxReconnectAttempts =
            maxAttempts >= 0 && this.attemptedReconnectCount >= maxAttempts

        // when we exceed the max attempts we should finally emit a close event
        if (exceededMaxReconnectAttempts) {
            this.orbitingClient.emit(
                'error',
                new WebSocketError('Exceeded max reconnect attempts'),
            )
            return
        }

        ++this.attemptedReconnectCount

        websocketLog(
            'Attempting to reconnect:',
            this.attemptedReconnectCount,
            'of',
            maxAttempts,
        )

        setTimeout(() => this.connect(), this.options.reconnectDelayMS || 5000)
    }

    private handlePacket(packet: Packet) {
        websocketLog('Received packet:', packet.type, packet.data)

        switch (packet.type) {
            case 'error':
                throw new WebSocketError(
                    'Received error packet: ' + packet.data,
                )

            case 'invalidate':
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
                )
                    throw new WebSocketError(
                        'Received invalid hello packet, please update the client',
                    )

                this.heartbeatLoop(packet.data.heartbeatIntervalMS as number)
                this.receivedHello = true
                break

            case 'config':
                if (
                    !packet.data ||
                    typeof packet.data !== 'object' ||
                    !('config' in packet.data)
                )
                    throw new WebSocketError(
                        'Received invalid config packet, please update the client',
                    )

                this.orbitingClient.emit('configUpdate', packet.data.config)
                break

            case 'heartbeat':
                break // there's nothing to be done in response to a heartbeat (yet)

            default:
                throw new WebSocketError(
                    `Received unknown packet type: ${packet.type}, please update the client`,
                )
        }
    }

    private heartbeatLoop(heartbeatIntervalMS: number) {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout)
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return // we don't need to throw an error, we can just assume that the connection is closed
        }

        // send with an empty object because that is what's required by the server
        this.sendPacket('heartbeat', {})

        this.heartbeatTimeout = setTimeout(
            this.heartbeatLoop.bind(this),
            heartbeatIntervalMS,
            heartbeatIntervalMS,
        )
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
        this.selfClose = true

        if (this.ws) {
            this.ws.close()
        }
    }
}
