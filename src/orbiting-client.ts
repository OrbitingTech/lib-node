import type { InferTypeFromSchema } from './types/json-schema-infer-type.js'
import type { JSONSchema } from './types/schema.js'
import type { WebSocketOptions } from './websocket-handler.js'
import type { AxiosInstance } from 'axios'

import { EventEmitter } from 'node:events'
import axios from 'axios'

import { generateDefaultsFromSchema } from './utils/generate-defaults-from-schema.js'
import { WebSocketClient } from './websocket-handler.js'

export type ClientSettings = {
    token: string
    baseURL?: string
} & ({ fetchOnly: true } | { fetchOnly?: false; websocket?: WebSocketOptions })

export class OrbitingClient<T> extends EventEmitter {
    public config: T | null = null

    private isInitialized = false

    private readonly token: string
    private readonly baseURL: string

    private readonly axiosClient: AxiosInstance

    private readonly wsClient: WebSocketClient | null = null
    private readonly websocketURL: string | null = null

    constructor(private readonly settings: ClientSettings) {
        super()

        this.token = settings.token

        // default the base url to the public url
        this.baseURL = settings.baseURL || 'https://orbiting.app/api'
        this.axiosClient = axios.create({
            baseURL: this.baseURL,
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        })

        if (settings.fetchOnly) {
            this.fetchConfig()
            return
        }

        // parse the URL so we can figure out the websocket URL
        const websocketURL = new URL(this.baseURL)
        const websocketProtocol =
            websocketURL.protocol === 'https:' ? 'wss:' : 'ws:'

        websocketURL.protocol = websocketProtocol
        websocketURL.pathname = '/api/ws'

        this.websocketURL = websocketURL.toString()
        this.wsClient = new WebSocketClient(
            this.websocketURL,
            this.token,
            settings.websocket,
        )
    }

    schema<S extends JSONSchema>(
        schema: S,
    ): OrbitingClient<InferTypeFromSchema<S>> {
        this.config = generateDefaultsFromSchema(schema) as T

        this.axiosClient
            .post('/apps/schema', schema)
            // throw the initialization call into the promise chain,
            // after the schema is specified with no errors we are good to connect
            .then(() => this.init())
            .catch(err => {
                if (!axios.isAxiosError(err) || !err.response) {
                    throw err
                }

                throw new Error(
                    'Failed to send schema: ' + err.response.data.error,
                )
            })

        return this as unknown as OrbitingClient<InferTypeFromSchema<S>>
    }

    layout(layout: unknown) {
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
            if (!axios.isAxiosError(err) || !err.response) {
                throw err
            }

            throw new Error(
                'Failed to update the config: ' + err.response.data.error,
            )
        }

        this.config = response.data
        return this.config
    }

    private async init() {
        if (this.isInitialized) {
            throw new Error('Client is already initialized')
        }

        // regardless what happens below, we are initialized
        this.isInitialized = true

        if (this.settings.fetchOnly) {
            await this.fetchConfig()
            return
        }

        this.wsClient!.connect()
        this.wsClient!.on('config', (config: T) => {
            this.config = config
        })
    }
}
