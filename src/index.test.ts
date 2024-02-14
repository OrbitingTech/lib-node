import test from 'ava'

import { createClient } from './index.js'
import { OrbitingClient } from './orbiting-client.js'

test('createClient', t => {
    t.assert(createClient({ token: 'test' }) instanceof OrbitingClient)
})
