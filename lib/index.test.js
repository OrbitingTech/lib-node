import test from 'ava'
import { createClient } from './index.js'

test('it works', t => {
    t.log(
        createClient({
            token: 'test-token',
            baseURL: 'http://localhost:3000',
        }),
    )
})
