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

export function sortObjectArray<T>(
    array: T[],
    sortOnProperty: keyof T,
    ascending = true
): T[] {
    array.sort((a, b) => {
        if (a[sortOnProperty] > b[sortOnProperty]) return ascending ? 1 : -1
        if (a[sortOnProperty] < b[sortOnProperty]) return ascending ? -1 : 1
        return 0
    })
    return array
}
