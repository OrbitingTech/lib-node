import type { ClientSettings } from './orbiting-client'

import { OrbitingBuilder } from './orbiting-client'

type OrbitingModule = {
    withSettings(settings: ClientSettings): OrbitingBuilder
}

const orbiting: OrbitingModule = Object.freeze({
    withSettings(settings) {
        return new OrbitingBuilder(settings)
    },
})

export type * from './types/infer-schema'
export type * from './types/schema'

export type * from './orbiting-client'
export * from './orbiting-client'

export type * from './websocket-handler'
export * from './websocket-handler'

export default orbiting
