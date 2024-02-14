import type { ClientSettings } from './orbiting-client.js'

import { OrbitingClient } from './orbiting-client.js'

export function createClient(config: ClientSettings) {
    return new OrbitingClient(config)
}

export type * from './types/json-schema-infer-type.js'
export type * from './types/schema.js'
export * from './orbiting-client.js'
