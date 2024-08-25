import type { InferObjectType } from '../types/infer-schema.js'
import type { ObjectProperties } from '../types/schema.js'

export function generateDefaultsFromSchema<S extends ObjectProperties>(
    schema: S,
): InferObjectType<S> {
    const defaults: Record<string, unknown> = {}

    for (const [propertyName, property] of Object.entries(schema)) {
        if (property.default === undefined) {
            throw new Error(
                `Property "${propertyName}" is missing a default value`,
            )
        }

        // there is no reason to do any more than the top level of the object
        // since this is how it works on the backend as well

        defaults[propertyName] = property.default
    }

    return defaults as InferObjectType<S>
}
