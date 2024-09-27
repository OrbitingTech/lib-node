import type {
    ArrayProperty,
    ObjectProperties,
    ObjectProperty,
    PropertyType,
    PropertyTypeMap,
    StringWithEnumProperty,
} from './schema.js'

export type InferObjectType<Properties extends ObjectProperties> = {
    readonly [K in keyof Properties]: InferIsNullable<
        Properties[K],
        InferSchemaType<Properties[K]>
    >
}

export type InferArrayType<ArrayType extends ArrayProperty> =
    PropertyTypeMap[ArrayType['items']['type']][]

export type InferSchemaType<ItemSchema extends PropertyType> =
    ItemSchema extends ObjectProperty
        ? InferObjectType<ItemSchema['properties']>
        : ItemSchema extends ArrayProperty
          ? InferArrayType<ItemSchema>
          : // todo: I hate this being hard-coded in
            ItemSchema extends StringWithEnumProperty<infer EnumType>
            ? EnumType
            : PropertyTypeMap[ItemSchema['type']]

// could not get this to work so I'm cheating for now ^, the reason is because
// everywhere the generic is used it is automatically inferred, and broadened to type string
// ItemSchema extends Property<keyof PropertyTypeMap, infer Type>
//   ? Type
//   : never
// doing something like the above would allow for the InferArrayType helper
// to do nearly the same thing, which would mean less code for similar functionality

export type InferIsNullable<
    ItemSchema extends PropertyType,
    T,
> = ItemSchema extends { nullable: infer IsNullable }
    ? IsNullable extends true // typescript is fun
        ? T | null
        : T
    : T
