import test from 'ava'

import { generateDefaultsFromSchema } from './generate-defaults-from-schema.js'

test('generateDefaultsFromSchema', t => {
    t.deepEqual(
        generateDefaultsFromSchema({
            foo: { type: 'string', default: 'bar' },
        }),
        { foo: 'bar' },
    )

    t.deepEqual(
        generateDefaultsFromSchema({
            foo: { type: 'string', default: 'bar' },
            bar: { type: 'number', default: 42 },
        }),
        { foo: 'bar', bar: 42 },
    )

    t.throws(() => {
        generateDefaultsFromSchema({
            // @ts-expect-error we're testing invalid schemas
            foo: { type: 'string' },
        })
    })
})
