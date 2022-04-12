export function isStringArraySortedAscending(
    values: string[],
    ignorePunctuation = false
): boolean {
    for (let i = 1; i < values.length; i += 1) {
        if (
            values[i].localeCompare(values[i - 1], 'en', {
                ignorePunctuation,
            }) < 0
        ) {
            return false
        }
    }

    return true
}

export function isStringArraySortedDescending(
    values: string[],
    ignorePunctuation = false
): boolean {
    for (let i = 1; i < values.length; i += 1) {
        if (
            values[i].localeCompare(values[i - 1], 'en', {
                ignorePunctuation,
            }) > 0
        ) {
            return false
        }
    }

    return true
}

export function isNumberArraySortedAscending(values: number[]): boolean {
    for (let i = 1; i < values.length; i += 1) {
        if (values[i] < values[i - 1]) {
            return false
        }
    }

    return true
}

export function isNumberArraySortedDescending(values: number[]): boolean {
    for (let i = 1; i < values.length; i += 1) {
        if (values[i] > values[i - 1]) {
            return false
        }
    }

    return true
}
