export function map<T, U>(iterator: Iterator<U>, f: (u: U) => T): Iterator<T> {
    return {
        next(...args: [] | [undefined]) {
            const {value, done} = iterator.next(...args)
            return { value: f(value), done }
        },
    }
}