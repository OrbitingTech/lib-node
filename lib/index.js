import { OrbitingClient } from './builder.js'

/**
 * @param {import('./builder.js').OrbitingConfig} config Config for the Orbiting Client
 * @returns {OrbitingClient} A new instance of the Orbiting Client
 */
export function createClient(config) {
    return new OrbitingClient(config)
}
