export type JSONSchemaType = {
    string: string
    number: number
    integer: number
    boolean: boolean
    object: Record<string, unknown>
    array: unknown[]
}

// typescript is both a blessing and a curse
export type InferTypeFromSchema<T> = T extends {
    type: 'object'
    properties: Record<string, unknown>
}
    ? { [P in keyof T['properties']]: InferTypeFromSchema<T['properties'][P]> }
    : T extends { type: 'array'; items: { type: infer JSType } }
      ? JSType extends keyof JSONSchemaType
          ? JSONSchemaType[JSType][]
          : never
      : T extends { type: infer JSType }
        ? JSType extends keyof JSONSchemaType
            ? JSONSchemaType[JSType]
            : never
        : never
