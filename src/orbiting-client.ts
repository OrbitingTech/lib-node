import type { InferObjectType } from './types/infer-schema.js'
import type { Layout } from './types/layout.js'
import type { ObjectProperties } from './types/schema.js'
import type { WebSocketOptions } from './websocket-handler.js'
import type { AxiosInstance } from 'axios'

import { EventEmitter } from 'node:events'
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs'
import axios from 'axios'

import { OrbitingError } from './errors.js'
import { log } from './logger.js'
import { generateDefaultsFromSchema } from './utils/generate-defaults-from-schema.js'
import { isNewCacheObject } from './utils/object-cache.js'
import { parseJwtPayload } from './utils/parse-jwt-payload.js'
import { WebSocketClient } from './websocket-handler.js'

const API_BASE_URL = 'https://orbiting.app/api'

export type ClientUpdateMode = 'offline' | 'fetch' | 'live'

export type ClientSettings = {
    token: string

    caching?: CacheSettings
    baseURL?: string

    offline?: OfflineSettings

    websocket?: WebSocketOptions

    mode?: ClientUpdateMode
    fetchFrequencySecs?: number
}

export type OfflineSettings = {
    file?: string
    watch?: boolean
}

export type CacheSettings = {
    schema?: boolean
    layout?: boolean
}

export type AppSettings<S extends ObjectProperties> = {
    schema: S
    layout: Layout<S> | null
}

export class OrbitingBuilder<
    Schema extends ObjectProperties = NonNullable<unknown>,
> {
    private schema: Schema = {} as Schema
    private layout: Layout<Schema> | null = null

    constructor(private readonly settings: ClientSettings) {}

    public withSchema<NewSchema extends ObjectProperties>(
        schema: NewSchema,
    ): OrbitingBuilder<NewSchema> {
        // @ts-expect-error this is still the old schema type
        this.schema = schema

        // @ts-expect-error now that the schema type has been changed
        return this as OrbitingBuilder<NewSchema>
    }

    public withLayout(...layout: Layout<Schema>) {
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
    private fetchInterval: ReturnType<typeof setInterval> | null = null

    private watchController: AbortController | null = null

    private isInitialized: boolean = false

    public tokenType: string = 'dev'
    private tokenIdPart: string = 'unset'

    constructor(
        private readonly settings: ClientSettings & AppSettings<Schema>,
    ) {
        super()

        const payload = parseJwtPayload(settings.token)

        if (typeof payload?.tokenType === 'string')
            this.tokenType = payload.tokenType

        if (typeof payload?.token === 'string')
            this.tokenIdPart = payload?.token.slice(-6)

        this._config = generateDefaultsFromSchema(settings.schema)

        this.on('error', err => {
            log('Error:', err.message)
        })

        const baseURL = settings.baseURL || API_BASE_URL
        this.axiosClient = axios.create({
            baseURL: baseURL,
            headers: { Authorization: `Bearer ${this.settings.token}` },
        })

        settings.mode ??= 'fetch'
        if (settings.mode !== 'live') {
            return
        }

        // parse the URL so we can figure out the websocket URL
        const websocketURL = new URL(baseURL)
        const websocketProtocol =
            websocketURL.protocol === 'https:' ? 'wss:' : 'ws:'

        websocketURL.protocol = websocketProtocol
        websocketURL.pathname += '/ws'

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
        const getCacheKey = (key: string) => {
            return `${key}-${this.tokenType}-${this.tokenIdPart}`
        }

        try {
            const cacheSchema = this.settings.caching?.schema ?? true
            const cacheLayout = this.settings.caching?.layout ?? true

            if (
                !cacheSchema ||
                isNewCacheObject(getCacheKey('schema'), this.settings.schema)
            )
                await this.axiosClient.post('/apps/schema', {
                    type: 'object',
                    properties: this.settings.schema,
                })

            if (
                this.settings.layout &&
                (!cacheLayout ||
                    isNewCacheObject(
                        getCacheKey('layout'),
                        this.settings.layout,
                    ))
            )
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
        log('Fetching new config...')

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

        log('Config fetched and updated')

        this._config = response.data
        this.emit('configUpdate', this._config)
    }

    private watchFile() {
        const fileName = this.settings.offline?.file || 'orbiting.json'

        const readFileToJson = () => {
            const fileContents = readFileSync(fileName, 'utf-8')
            const parsed = JSON.parse(fileContents)

            delete parsed['$schema']
            return parsed
        }

        try {
            if (!existsSync(fileName)) {
                log(
                    `Creating default \`${fileName}\` with defaults from schema`,
                )

                // create the initial file with the config we currently have & schema
                writeFileSync(
                    fileName,
                    // todo: populate $schema property with valid path to user's schema in json file
                    JSON.stringify({ $schema: '', ...this._config }, null, 2),
                    'utf-8',
                )
            } else {
                this._config = Object.assign({}, this._config, readFileToJson())
            }
        } catch (err) {
            throw new OrbitingError(
                'Failed to parse offline configuration file: ' + err,
            )
        }

        if (!(this.settings.offline?.watch ?? true)) {
            return
        }

        this.watchController = new AbortController()

        watch(fileName, { signal: this.watchController.signal }, event => {
            if (event !== 'change') {
                return
            }

            log('Config file changed, reading new contents')

            try {
                // assign as a temporary fix for missing properties in the file
                this._config = Object.assign({}, this._config, readFileToJson())
                this.emit('configUpdate', this._config)

                log('Updated config')
            } catch (err) {
                log(`Failed to parse \`${fileName}\` to JSON`, err)
            }
        })

        log(`Now watching \`${fileName}\` for changes`)
    }

    async init() {
        if (this.isInitialized) {
            throw new OrbitingError('Client is already initialized')
        }

        // regardless what happens below, we are initialized
        this.isInitialized = true

        if (this.settings.mode === 'offline') {
            this.watchFile()
            return
        }

        await this.sendSettings()

        if (this.settings.mode === 'fetch') {
            // do the first initial fetch
            await this.fetchConfig()

            this.fetchInterval = setInterval(
                this.fetchConfig.bind(this),
                (this.settings.fetchFrequencySecs ?? 60 * 30) * 1000,
            )

            return
        }

        this.wsClient!.connect()

        // todo: make this not dependent on the listeners system, since, if someone decides
        // to clear all listeners they will likely get an unexpected result
        this.on('configUpdate', config => {
            this._config = config
        })
    }

    close() {
        if (this.watchController) {
            this.watchController.abort()
            this.watchController = null
        }

        if (this.wsClient) {
            this.wsClient.close()
        }

        if (this.fetchInterval) {
            clearInterval(this.fetchInterval)
            this.fetchInterval = null
        }
    }
}
