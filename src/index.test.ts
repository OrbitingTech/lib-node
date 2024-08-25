import test from 'ava'

import orbiting from './index'
import { OrbitingClient } from './orbiting-client'

test('createClient', t => {
    t.assert(
        orbiting.withSettings({ token: 'test' }).createConnection() instanceof
            OrbitingClient,
    )
})
