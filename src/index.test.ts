import test from 'ava'

import { createClient } from './index.js'

test('it works', t => {
    t.timeout(300000)

    const orb = createClient({
        token: process.env.ORBITING_TOKEN as string,
        baseURL: 'http://localhost:3000/api', // just developer stuff
    }).schema({
        type: 'object',
        properties: {
            foo: { type: 'string', default: '' },
            bar: { type: 'integer', default: 1 },
            baz: { type: 'array', items: { type: 'number' }, default: [] },
        },
    } as const)

    // logs the current config every 2 seconds
    setInterval(() => {
        console.log(orb.config)
    }, 2000)

    t.pass()
})
