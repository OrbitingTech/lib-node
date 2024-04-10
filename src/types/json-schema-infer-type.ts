export type JSONSchemaType = {
    string: string
    number: number
    integer: number
    boolean: boolean
    object: Record<string, unknown>
    array: unknown[]
}

// typescript is both a blessing and a curse
// todo: I am sorry for this lol
export type InferTypeFromSchema<T> = T extends {
    type: 'object'
    properties: Record<string, unknown>
}
    ? {
          readonly [P in keyof T['properties']]: InferTypeFromSchema<
              T['properties'][P]
          >
      }
    : T extends { type: 'array'; items: { type: infer JSType } }
      ? JSType extends keyof JSONSchemaType
          ? readonly JSONSchemaType[JSType][]
          : never
      : T extends { type: infer JSType; nullable?: infer IsNullable }
        ? JSType extends keyof JSONSchemaType
            ? IsNullable extends true
                ? JSONSchemaType[JSType] | null
                : JSONSchemaType[JSType]
            : never
        : never
