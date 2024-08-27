import type { ObjectProperties } from './schema.js'

type SchemaType = ObjectProperties

export type Layout<Schema extends SchemaType> = LayoutSection<Schema>[]

export type LayoutSection<Schema extends SchemaType> = {
    title?: string
    description?: string

    controls: {
        [Key in keyof Schema]: Control<Schema, Key>
    }[keyof Schema][] // create a map of each key to its Control type then transform it into a union array type
}

export type Control<Schema extends SchemaType, Key extends keyof Schema> = {
    for: Key
    label?: string
    renderAs?: ControlRenderAsMap[Schema[Key]['type']]
}

export type NumberRenderAs = 'input' | 'slider'

export type ControlRenderAsMap = {
    string: 'input' | 'multiline'
    number: NumberRenderAs
    integer: NumberRenderAs
    boolean: 'switch' | 'checkbox'
    object: 'fixedTable'
    array: 'dynamicList'
}
