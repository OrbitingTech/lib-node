import test from 'ava'

import orbiting from './index.js'
import { OrbitingClient } from './orbiting-client.js'

test('createClient', t => {
    t.assert(
        orbiting.withSettings({ token: 'test' }).createConnection() instanceof
            OrbitingClient,
    )
})
