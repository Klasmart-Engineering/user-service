import { createHash } from 'crypto'
import { config } from '../config/config'
import { APIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import clean from './clean'

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

export function newValidateShortCode(
    entity: 'Class' | 'School' | 'Organization',
    code: string | undefined,
    index?: number,
    maxlen = SHORTCODE_DEFAULT_MAXLEN
): APIError[] {
    const errors: APIError[] = []

    if (code === undefined) {
        return errors
    }
    if (code?.length > maxlen) {
        errors.push(
            new APIError({
                code: customErrors.invalid_max_length.code,
                message: customErrors.invalid_max_length.message,
                variables: [],
                entity,
                index,
            })
        )
    }
    const shortcode_re = /^[A-Z|0-9]+$/
    if (!code.match(shortcode_re)) {
        errors.push(
            new APIError({
                code: customErrors.invalid_alphanumeric.code,
                message: customErrors.invalid_alphanumeric.message,
                attribute: 'shortcode',
                variables: [],
                entity,
                index,
            })
        )
    }
    return errors
}

export function validateShortCode(
    code?: string,
    maxlen = SHORTCODE_DEFAULT_MAXLEN
): boolean {
    // the entity value here doesn't matter as we don't surface the error message
    return newValidateShortCode('Class', code, maxlen).length === 0
}

export function formatShortCode(
    code?: string,
    length?: number
): string | undefined {
    code = clean.shortcode(code)
    return validateShortCode(code, length ?? config.limits.SHORTCODE_MAX_LENGTH)
        ? code
        : undefined
}
