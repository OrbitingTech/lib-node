import type { ClientSettings } from './orbiting-client.js'

import { OrbitingClient } from './orbiting-client.js'

export function createClient(config: ClientSettings) {
    return new OrbitingClient(config)
}
