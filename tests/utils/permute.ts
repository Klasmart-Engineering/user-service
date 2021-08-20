// Taken from https://stackoverflow.com/a/37580979
export function permutations(elements: any[]) {
    const length = elements.length
    const result = [elements.slice()]
    const c = new Array(length).fill(0)
    let i = 1
    let k
    let p

    while (i < length) {
        if (c[i] < i) {
            k = i % 2 && c[i]
            p = elements[i]
            elements[i] = elements[k]
            elements[k] = p
            ++c[i]
            i = 1
            result.push(elements.slice())
        } else {
            c[i] = 0
            ++i
        }
    }
    return result
}

export function permutationsWithRepetition(
    elements: any[],
    length = elements.length
) {
    const base = elements.length
    const counter = Array(length).fill(base === 1 ? elements[0] : 0)
    if (base === 1) return [counter]
    const combos = []
    const increment = (i: number) => {
        if (counter[i] === base - 1) {
            counter[i] = 0
            increment(i - 1)
        } else {
            counter[i]++
        }
    }

    for (let i = base ** length; i--; ) {
        combos.push(counter.map((c) => elements[c]))
        increment(counter.length - 1)
    }

    return combos
}
