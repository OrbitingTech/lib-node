import type { OrbitingConfig } from './orbiting-client.js'

import { OrbitingClient } from './orbiting-client.js'

export function createClient(config: OrbitingConfig) {
    return new OrbitingClient(config)
}
