// I can't possibly list all of the types, so I'll just use a catch-all
export type WhateverTheHellElse = { [key: string]: unknown }

export type PropertyType =
    | ObjectProperty
    | ArrayProperty
    | NumberProperty
    | StringProperty
    | BooleanProperty

export type TopLevelObjectProperty = Pick<
    ObjectProperty,
    'type' | 'properties'
> & {
    // make all the top-level properties be required to have a default
    properties: Record<
        string,
        PropertyType & Required<Pick<PropertyType, 'default'>>
    >
}

// todo: support fluent-json-schema and zod
export type JSONSchema = TopLevelObjectProperty

export type ObjectProperty = {
    type: 'object'
    properties: Record<string, PropertyType>
    default?: Record<string, unknown>

    additionalProperties?: boolean
    patternProperties?: Record<string, PropertyType>
    required?: string[]
} & WhateverTheHellElse

export type ArrayProperty = {
    type: 'array'
    items: { type: PropertyType['type'] }
    default?: unknown[]
} & WhateverTheHellElse

export type NumberProperty = {
    type: 'number' | 'integer'
    default?: number
} & WhateverTheHellElse

export type StringProperty = {
    type: 'string'
    default?: string
} & WhateverTheHellElse

export type BooleanProperty = {
    type: 'boolean'
    default?: boolean
} & WhateverTheHellElse
