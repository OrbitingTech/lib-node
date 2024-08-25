import type {
    ArrayProperty,
    ObjectProperties,
    ObjectProperty,
    PropertyType,
    PropertyTypeMap,
} from './schema'

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
          : PropertyTypeMap[ItemSchema['type']]

export type InferIsNullable<
    ItemSchema extends PropertyType,
    T,
> = ItemSchema extends { nullable: infer IsNullable }
    ? IsNullable extends true // typescript is fun
        ? T | null
        : T
    : T
