import type { ObjectProperties } from './schema.js'

type SchemaType = ObjectProperties

export type Layout<Schema extends SchemaType> = LayoutSection<Schema>[]

export type LayoutSection<Schema extends SchemaType> = {
    title?: string
    description?: string

    controls: Control<Schema>[]
}

export interface Control<Schema extends SchemaType> {
    for: keyof Schema
    label?: string
    renderAs?: ControlRenderAsMap[Schema[this['for']]['type']]
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
