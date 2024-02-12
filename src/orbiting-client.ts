import type { InferTypeFromSchema } from './json-schema-infer.js'
import type { AxiosInstance } from 'axios'

import { EventEmitter } from 'node:events'
import axios from 'axios'
import { WebSocket } from 'ws'

export type OrbitingConfig = {
    token: string
    baseURL?: string
    fetchOnly?: boolean
}

export class OrbitingClient<T> extends EventEmitter {
    public config: T | null = null

    private readonly token: string
    private readonly baseURL: string

    private readonly axiosClient: AxiosInstance

    private readonly websocketURL: string | null = null
    private readonly ws: WebSocket | null = null

    constructor(config: OrbitingConfig) {
        super()

        this.token = config.token

        // default the base url to the public url
        this.baseURL = config.baseURL || 'https://orbiting.app/api'
        this.axiosClient = axios.create({
            baseURL: this.baseURL,
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        })

        if (config.fetchOnly) {
            this.fetchConfig()
            return
        }

        // parse the URL so we can figure out the websocket URL
        const websocketURL = new URL(this.baseURL)
        const websocketProtocol =
            websocketURL.protocol === 'https:' ? 'wss:' : 'ws:'

        websocketURL.protocol = websocketProtocol
        websocketURL.pathname = '/ws'

        this.websocketURL = websocketURL.toString()
        this.ws = new WebSocket(this.websocketURL)

        this.initWebsocket()
    }

    schema<S>(schema: S): OrbitingClient<InferTypeFromSchema<S>> {
        this.axiosClient.post('/apps/schema', schema).catch(err => {
            if (!axios.isAxiosError(err) || !err.response) {
                throw err
            }

            throw new Error('Failed to send schema: ' + err.response.data.error)
        })

        return this as unknown as OrbitingClient<InferTypeFromSchema<S>>
    }

    layout(layout: unknown): this {
        this.axiosClient.post('/apps/layout', { layout }).catch(err => {
            if (!axios.isAxiosError(err) || !err.response) {
                throw err
            }

            throw new Error('Failed to send layout: ' + err.response.data.error)
        })

        return this
    }

    async fetchConfig() {
        let response
        try {
            response = await this.axiosClient.get('/apps/config')
        } catch (err) {
            throw new Error(
                'Failed to fetch config, check your token and URL: ',
                // err.message,
            )
        }

        this.config = response.data
    }

    /**
     * @private
     */
    initWebsocket() {
        if (!this.websocketURL || !this.ws) {
            throw new Error('No websocket URL to connect to')
        }

        this.ws.on('open', () => {
            this.emit('open')
        })

        // this.ws.on('message', data => {})
    }
}
