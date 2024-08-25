export type PropertyTypeMap = {
    string: string
    number: number
    integer: number
    boolean: boolean
    object: Record<string, unknown>
    array: unknown[]
}

export type PropertyType =
    | ObjectProperty
    | ArrayProperty
    | NumberProperty
    | Property<'string'>
    | Property<'boolean'>

export interface PropertyMetadata {}

export interface Property<
    Type extends keyof PropertyTypeMap,
    SchemaType = PropertyTypeMap[Type],
> extends PropertyMetadata {
    /**
     * The display name for this property on the Orbiting dashboard.
     */
    title?: string

    /**
     * Typically used as a foot note to describe what this property does.
     */
    description?: string

    type: Type
    default: SchemaType | null
    nullable?: boolean
}

export type ObjectProperties = Record<string, PropertyType>

export interface ObjectProperty extends Property<'object'> {
    properties: ObjectProperties

    additionalProperties?: boolean
    patternProperties?: ObjectProperties
    required?: string[]
}

export interface ArrayProperty extends Property<'array'> {
    // todo: items: PropertyType (lots of frontend work must be done for this)
    items: { type: keyof PropertyTypeMap }
}

export interface NumberProperty extends Property<'integer' | 'number'> {
    minimum?: number
    maximum?: number
}
