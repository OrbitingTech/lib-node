import type { InferObjectType } from './types/infer-schema.js'
import type { ObjectProperties } from './types/schema.js'
import type { WebSocketOptions } from './websocket-handler.js'
import type { AxiosInstance } from 'axios'

import { EventEmitter } from 'node:events'
import axios from 'axios'

import { OrbitingError } from './errors.js'
import { log } from './logger.js'
import { generateDefaultsFromSchema } from './utils/generate-defaults-from-schema.js'
import { WebSocketClient } from './websocket-handler.js'

const API_BASE_URL = 'https://orbiting.app/api'

export type ClientSettings = {
    token: string

    devMode?: boolean
    baseURL?: string

    fetchOnly?: boolean
    websocket?: WebSocketOptions
}

export type AppSettings<S extends ObjectProperties> = {
    schema: S
    layout: unknown // todo
}

export class OrbitingBuilder<
    Schema extends ObjectProperties = NonNullable<unknown>,
> {
    private schema: Schema = {} as Schema
    private layout: unknown = null

    constructor(private readonly settings: ClientSettings) {}

    public withSchema<NewSchema extends ObjectProperties>(
        schema: NewSchema,
    ): OrbitingBuilder<NewSchema> {
        // @ts-expect-error this is still the old schema type
        this.schema = schema

        // @ts-expect-error now that the schema type has been changed
        return this as OrbitingBuilder<NewSchema>
    }

    public withLayout(layout: unknown) {
        this.layout = layout
        return this
    }

    public createConnection(): OrbitingClient<Schema> {
        const client = new OrbitingClient({
            ...this.settings,
            layout: this.layout,
            schema: this.schema,
        })

        client.init()

        return client
    }
}

export declare interface OrbitingClient<Schema> {
    on(
        event: 'configUpdate',
        listener: (config: InferObjectType<Schema>) => void,
    ): this

    on(event: 'error', listener: (error: OrbitingError) => void): this
}

export class OrbitingClient<
    Schema extends ObjectProperties,
> extends EventEmitter {
    private _config: InferObjectType<Schema>

    private readonly axiosClient: AxiosInstance
    private readonly wsClient: WebSocketClient<Schema> | null = null

    private isInitialized: boolean = false

    constructor(
        private readonly settings: ClientSettings & AppSettings<Schema>,
    ) {
        super()

        this._config = generateDefaultsFromSchema(settings.schema)

        this.on('error', err => {
            log('Error:', err.message)
        })

        const baseURL = settings.baseURL || API_BASE_URL
        this.axiosClient = axios.create({
            baseURL: baseURL,
            headers: { Authorization: `Bearer ${this.settings.token}` },
        })

        if (settings.fetchOnly) {
            this.fetchConfig()
            return
        }

        // parse the URL so we can figure out the websocket URL
        const websocketURL = new URL(baseURL)
        const websocketProtocol =
            websocketURL.protocol === 'https:' ? 'wss:' : 'ws:'

        websocketURL.protocol = websocketProtocol
        websocketURL.pathname = '/api/ws'

        this.wsClient = new WebSocketClient(
            this,
            websocketURL.toString(),
            settings.token,
            settings.websocket,
        )
    }

    public get config() {
        return this._config
    }

    private async sendSettings() {
        try {
            await this.axiosClient.post('/apps/schema', {
                type: 'object',
                properties: this.settings.schema,
            })

            await this.axiosClient.post('/apps/layout', {
                layout: this.settings.layout,
            })
        } catch (err) {
            if (!axios.isAxiosError(err) || !err.response) {
                throw err
            }

            throw new OrbitingError(
                'Failed to push new application settings: ' +
                    err.response.data.error,
            )
        }
    }

    private async fetchConfig() {
        let response
        try {
            response = await this.axiosClient.get('/apps/config')
        } catch (err) {
            if (!axios.isAxiosError(err) || !err.response) {
                throw err
            }

            throw new OrbitingError(
                'Failed to update the config: ' + err.response.data.error,
            )
        }

        this._config = response.data
        return this.config
    }

    async init() {
        if (this.isInitialized) {
            throw new OrbitingError('Client is already initialized')
        }

        await this.sendSettings()

        // regardless what happens below, we are initialized
        this.isInitialized = true

        if (this.settings.fetchOnly) {
            await this.fetchConfig()
            return
        }

        this.wsClient!.connect()
    }

    close() {
        if (this.settings.fetchOnly || !this.wsClient) {
            return
        }

        this.wsClient.close()
    }
}
