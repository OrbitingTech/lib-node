import type { ClientSettings } from './orbiting-client.js'

import { OrbitingBuilder } from './orbiting-client.js'

type OrbitingModule = {
    withSettings(settings: ClientSettings): OrbitingBuilder
}

const orbiting: OrbitingModule = Object.freeze({
    withSettings(settings) {
        return new OrbitingBuilder(settings)
    },
})

export type * from './types/infer-schema.js'
export type * from './types/schema.js'

export type * from './orbiting-client.js'
export * from './orbiting-client.js'

export type * from './websocket-handler.js'
export * from './websocket-handler.js'

export default orbiting
