import { expect } from 'chai'

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
