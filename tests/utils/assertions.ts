import { expect } from 'chai'
import { CustomBaseEntity } from '../../src/entities/customBaseEntity'
import { User } from '../../src/entities/user'

/**
 *
 * @param value `SomeType | null | undefined`
 *
 * `Chai.expect`, with additional Type narrowing to `SomeType` if the assertion passes
 */
export function expectIsNonNullable<V extends unknown>(
    value: V
): asserts value is NonNullable<V> {
    expect(value).to.exist
}

/**
 * Converts two entities to strings in order to compare them,
 * ignores property ordering
 */
export function compareEntities<T extends CustomBaseEntity>(
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

export function compareMultipleEntities<T extends CustomBaseEntity>(
    objects: T[],
    expectedObjects: T[]
) {
    expect(objects.length).to.equal(expectedObjects.length)
    for (let i = 0; i < objects.length; i++) {
        compareEntities(objects[i], expectedObjects[i])
    }
}
