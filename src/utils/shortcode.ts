import { createHash } from 'crypto'

export const SHORTCODE_DEFAULT_MAXLEN = 10

const sha256 = (message: string) => {
    const hash = createHash('sha256')
    hash.update(message)
    return hash.digest()
}

export function generateShortCode(
    source?: string,
    maxlen = SHORTCODE_DEFAULT_MAXLEN
): string {
    const possible = 'ABCDEFGHIKLMNOPQRSTUVWXYZ0123456789'

    if (source) {
        const shaBuffer = sha256(source)
        source = Buffer.from(shaBuffer).toString('hex')
        const bi = BigInt('0x00' + source)
        source = bi.toString(36).toUpperCase()
    }
    let result = ''
    source = source || ''
    result = source.length > maxlen ? source.substr(0, maxlen) : source

    for (let i = source.length; i < maxlen; i++) {
        result += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return result
}

export function validateShortCode(
    code?: string,
    maxlen = SHORTCODE_DEFAULT_MAXLEN
): boolean {
    const shortcode_re = /^[A-Z|0-9]+$/
    if (code && code.length <= maxlen && code.match(shortcode_re)) {
        return true
    }
    return false
}
