/**
 * Require type U to implement type T
 *
 * e.g
 * type T = {foo: string | number}
 * type U = Implements<T, {foo: string}
 */
export type Implements<T, U extends T> = U
