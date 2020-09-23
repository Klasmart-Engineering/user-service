export type Like<T> = undefined|T|(() => Promise<T|undefined>|T|undefined)
