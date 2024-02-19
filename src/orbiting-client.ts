import type { InferTypeFromSchema } from './types/json-schema-infer-type.js'
import type { JSONSchema } from './types/schema.js'
import type { WebSocketOptions } from './websocket-handler.js'
import type { AxiosInstance } from 'axios'

import { EventEmitter } from 'node:events'
import axios from 'axios'

import { log } from './logger.js'
import { generateDefaultsFromSchema } from './utils/generate-defaults-from-schema.js'
import { WebSocketClient } from './websocket-handler.js'

export type ClientSettings = {
    token: string
    baseURL?: string
    fetchOnly?: boolean
    websocket?: WebSocketOptions
}

export class OrbitingError extends Error {
    name = 'OrbitingError'

    constructor(public readonly message: string) {
        super(message)
    }
}

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

        this.on('error', err => {
            log('Error:', err.message)
        })

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

    schema<
        P extends JSONSchema['properties'],
        S = { type: 'object'; properties: P },
    >(properties: P): OrbitingClient<InferTypeFromSchema<S>> {
        // no point in forcing the user to specify these
        // if they are required
        const schema = {
            type: 'object',
            properties,
        } as JSONSchema

        this.config = generateDefaultsFromSchema(schema) as T

        this.axiosClient.post('/apps/schema', schema).catch(err => {
            if (!axios.isAxiosError(err) || !err.response) {
                this.emit('error', err)
                log('Something went very wrong', err)
                return
            }

            // emit an error rather than throwing an error, since this promise is off in its
            // own world and the user might not be able to catch it
            this.emit('error', new OrbitingError(err.response.data.error))
        })

        return this as unknown as OrbitingClient<InferTypeFromSchema<S>>
    }

    layout(layout: unknown) {
        this.axiosClient.post('/apps/layout', { layout }).catch(err => {
            if (!axios.isAxiosError(err) || !err.response) {
                this.emit('error', err)
                log('Something went very wrong', err)
                return
            }

            this.emit('error', new OrbitingError(err.response.data.error))
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

            throw new OrbitingError(
                'Failed to update the config: ' + err.response.data.error,
            )
        }

        this.config = response.data
        return this.config
    }

    async init({ waitForReconnects = false }): Promise<T> {
        if (this.isInitialized) {
            throw new OrbitingError('Client is already initialized')
        }

        // regardless what happens below, we are initialized
        this.isInitialized = true

        if (this.settings.fetchOnly) {
            return this.fetchConfig() as T
        }

        this.wsClient!.connect()

        this.wsClient!.on('config', config => {
            this.config = config as T

            this.emit('update', config)
        })

        this.wsClient?.on('close', error => {
            if (error) {
                this.emit('error', error)
            }
        })

        // when we receive the first config packet, we can resolve via a promise
        // that makes use of the event emitters on the websocket handler
        return new Promise((resolve, reject) => {
            // if the user has specified to wait until the close event then we will not start
            // a timeout to reject the promise, this means `waitForClose` blocks
            // until the websocket finishes or fails all reconnect attempts
            const timeout = waitForReconnects
                ? undefined
                : setTimeout(() => {
                      cleanup()
                      reject(
                          new OrbitingError('Failed to initialize the client'),
                      )
                  }, this.settings.websocket?.timeoutMS || 5000)

            const onConfig = (config: T) => {
                cleanup()
                resolve(config)
            }

            const onClose = (error: Error) => {
                cleanup()
                reject(error)
            }

            // simple cleanup function to ensure nothing carries on past its desired lifespan
            const cleanup = () => {
                clearTimeout(timeout)

                // clear both event listeners so one of them doesn't continue living
                this.wsClient?.off('config', onConfig)
                this.wsClient?.off('close', onClose)
            }

            this.wsClient?.once('config', onConfig)
            this.wsClient?.once('close', onClose)
        })
    }

    close() {
        if (this.settings.fetchOnly) {
            return
        }

        this.wsClient?.close()
    }
}
