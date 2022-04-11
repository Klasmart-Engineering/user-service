import { expect } from 'chai'
import { CustomBaseEntity } from '../../src/entities/customBaseEntity'
import {
    CreateClassInput,
    UpdateClassInput,
} from '../../src/types/graphQL/class'
import { sortObjectArray } from '../../src/utils/array'

/**
 *
 * @param value `SomeType | null | undefined`
 *
 * `Chai.expect`, with additional Type narrowing to `SomeType` if the assertion passes
 */
export function expectIsNonNullable<V>(
    value: V
): asserts value is NonNullable<V> {
    expect(value).to.exist
}

type ComparableTypes = CustomBaseEntity | CreateClassInput | UpdateClassInput

/**
 * Converts two entities to strings in order to compare them,
 * ignores property ordering. It will also remove functions
 * from an object, both key and value.
 */
export function compareEntities<T extends ComparableTypes>(
    object: T,
    expectedObject: T
) {
    const objectString = JSON.stringify(object, Object.keys(object).sort())
    const xObjectString = JSON.stringify(
        expectedObject,
        Object.keys(expectedObject).sort()
    )
    expect(objectString).to.equal(xObjectString)
}

export function compareMultipleEntities<T extends ComparableTypes>(
    objects: T[],
    expectedObjects: T[],
    sortOnProperty?: keyof T
) {
    expect(objects.length).to.equal(expectedObjects.length)

    if (sortOnProperty) {
        objects = sortObjectArray(objects, sortOnProperty)
        expectedObjects = sortObjectArray(expectedObjects, sortOnProperty)
    }

    for (let i = 0; i < objects.length; i++) {
        compareEntities(objects[i], expectedObjects[i])
    }
}
