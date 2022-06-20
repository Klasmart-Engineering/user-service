// Reference: https://github.com/tjcafferkey/stringinject
/**
 * Replace placeholders in a string.
 *
 * Return `false` if the string is invalid.
 *
 * Usage:
 *
 * ```
 * import stringInject from 'string';
 *
 * Array:
 *  var string = stringInject("This is a {0} string for {1}", ["test", "stringInject"]);
 *
 * Object:
 *  var string = stringInject("My username is {username} on {platform}", { username: "tjcafferkey", platform: "GitHub" });
 *  var str = stringInject("My username is {user.name} on {platform}", { user: { name: "Robert" }, platform: "IRL" });
 * ```
 *
 * @param str string
 * @param data any
 * @returns string|Error
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stringInject(str: string, data: any) {
    if (data instanceof Array) {
        return str.replace(/({\d})/g, (i) => {
            return data[Number(i.replace(/{/, '').replace(/}/, ''))]
        })
    } else if (data instanceof Object) {
        if (Object.keys(data).length === 0) {
            return str
        }

        for (const _ in data) {
            return str.replace(/({([^}]+)})/g, (i) => {
                const key = i.replace(/{/, '').replace(/}/, '')

                const subKeys = key.split('.')
                if (subKeys.length > 1) {
                    try {
                        return subKeys.reduce((acc, k) => {
                            acc = acc[k]
                            return acc
                        }, data)
                    } catch (e) {
                        return `All data for ${key} does not exist!`
                    }
                }

                return data[key] || data[key] === 0 ? data[key] : i
            })
        }
    } else if (
        data instanceof Array === false ||
        data instanceof Object === false
    ) {
        return str
    } else {
        throw new Error('Failed to inject string')
    }
}

export function isHexadecimalColor(hex: string): boolean {
    return !!hex.match(/#([0-9a-fA-F]{2}){3,4}$/)
}

/**
 * A deterministic version of JSON.stringify() that ignores the order of properties.
 */
export function objectToKey<T extends Record<string, unknown> | string>(
    obj: T
) {
    if (typeof obj === 'string') return obj
    return JSON.stringify(obj, Object.keys(obj).sort())
}

// normal maps don't support non-primitive keys
// so this works by turning objects into JSON strings
// only supports string properties as object properties
// have weird edge cases like:
// * could be expensive
// * could be recursive
export class ObjMap<Key extends { [key: string]: string | number }, Value>
    implements Map<Key, Value> {
    private map: Map<string, Value>

    constructor(entries?: { key: Key; value: Value }[]) {
        if (entries !== undefined) {
            this.map = new Map(
                entries.map((entry) => [objectToKey(entry.key), entry.value])
            )
        } else {
            this.map = new Map()
        }
    }

    set(key: Key, value: Value) {
        this.map.set(objectToKey(key), value)
        return this
    }

    get(key: Key) {
        return this.map.get(objectToKey(key))
    }

    has(key: Key) {
        return this.map.has(objectToKey(key))
    }

    *keys(): IterableIterator<Key> {
        for (const key of this.map.keys()) {
            yield JSON.parse(key) as Key
        }
    }

    *values(): IterableIterator<Value> {
        for (const value of this.map.values()) {
            yield value
        }
    }

    *[Symbol.iterator](): IterableIterator<[Key, Value]> {
        for (const [key, value] of this.map.entries()) {
            yield [JSON.parse(key) as Key, value]
        }
    }

    *entries(): IterableIterator<[Key, Value]> {
        for (const entry of this) {
            yield entry
        }
    }

    clear() {
        return this.map.clear()
    }

    delete(key: Key): boolean {
        return this.map.delete(objectToKey(key))
    }

    forEach(
        callbackfn: (value: Value, key: Key, map: Map<Key, Value>) => void
    ) {
        this.map.forEach(
            (value: Value, key: string, map: Map<string, Value>) => {
                const objMap = new ObjMap<Key, Value>(
                    Array.from(map.entries()).map(([k, v]) => ({
                        key: JSON.parse(k) as Key,
                        value: v,
                    }))
                )
                callbackfn(value, JSON.parse(key) as Key, objMap)
            }
        )
    }

    get size() {
        return this.map.size
    }

    get [Symbol.toStringTag]() {
        return 'ObjMap'
    }
}
