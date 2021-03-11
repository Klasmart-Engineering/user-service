import { createHash } from 'crypto'

export const SHORTCODE_MAXLEN = 10

const sha256 = (message: string) => {
    const hash = createHash('sha256')
    hash.update(message)
    return hash.digest()
}

export function generateShortCode(source?: string): string {
    const possible = 'ABCDEFGHIKLMNOPQRSTUVWXYZ0123456789'

    if (source) {
        const shaBuffer = sha256(source)
        source = Buffer.from(shaBuffer).toString('hex')
        const bi = BigInt('0x' + source)
        source = bi.toString(36).toUpperCase()
    }
    let result = ''
    source = source || ''
    result =
        source.length > SHORTCODE_MAXLEN
            ? source.substr(0, SHORTCODE_MAXLEN)
            : source

    for (let i = source.length; i < SHORTCODE_MAXLEN; i++) {
        result += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return result
}
