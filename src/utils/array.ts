/**
 *
 * @returns whether all elements in the `subset` Array are contained in the `superset` Array
 */
export function isSubsetOf(
    subset: Array<unknown>,
    superset: Array<unknown>
): boolean {
    if (subset.length > superset.length) return false
    const elements = new Set(superset)
    return subset.every(elements.has, elements)
}
