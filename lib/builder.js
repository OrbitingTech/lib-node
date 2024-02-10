import { EventEmitter } from 'node:events'
import axios from 'axios'
import { WebSocket } from 'ws'

/**
 * @typedef {object} OrbitingConfig
 * @property {string} token The token to use for authentication
 * @property {string} [baseURL] The base URL of the Orbiting API
 * @property {boolean} [fetchOnly] Whether to only fetch the up-to-date config or
 * to connect to the Orbiting websocket in the background
 */
export class OrbitingClient extends EventEmitter {
    /**
     * @type {any}
     */
    config = {}

    /**
     * @type {WebSocket | null}
     * @private
     */
    ws = null

    /**
     * @param {OrbitingConfig} config Config for the Orbiting Client
     */
    constructor(config) {
        super()

        this.token = config.token

        // default the base url to the public url
        this.baseURL = config.baseURL || 'https://orbiting.app/'
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

        this.initWebsocket()
    }

    /**
     * Force an update of the {@link config} using the {@link token} and {@link baseURL} to contact the Orbiting API
     * @returns {Promise<void>}
     */
    async fetchConfig() {
        let response
        try {
            response = await this.axiosClient.get('/apps/config')
        } catch (err) {
            throw new Error(
                'Failed to fetch config, check your token and URL: ' +
                    err.message,
            )
        }

        this.config = response.data
    }

    /**
     * @private
     */
    initWebsocket() {
        if (!this.websocketURL) {
            throw new Error('No websocket URL to connect to')
        }

        this.ws = new WebSocket(this.websocketURL)
        this.ws.on('open', () => {
            this.emit('open')
        })

        this.ws.on('message', data => {})
    }
}
