import {
    getCountryCallCodeFromString,
    normalizePhoneNumber,
} from './phoneNumberCleaning'
import { isEmail, isPhone } from './validations'

export const uniqueAndTruthy = <T>(array: Array<T> | undefined): T[] => {
    if (!array) return []
    return [...new Set(array.filter((a) => a))]
}

export const normalizedLowercaseTrimmed = (x?: string) =>
    x?.normalize('NFKC').toLowerCase().trim()

export function unswapEmailAndPhone(
    email?: string | null,
    phone?: string | null
): { email: string | undefined | null; phone: string | undefined | null } {
    let emailAsPhone
    try {
        emailAsPhone = cleanPhone(email)
    } catch {
        emailAsPhone = undefined
    }

    if (
        email !== null &&
        !isEmail(email) &&
        emailAsPhone !== null &&
        isPhone(emailAsPhone)
    ) {
        phone = emailAsPhone
        email = undefined
    } else if (phone !== null && !isPhone(phone) && isEmail(phone)) {
        email = phone
        phone = undefined
    }
    return { email, phone }
}

// hack to avoid a migration
export function denormalizedValues(value: string): string[] {
    const withoutLeadingPlus = value.substr(1)
    let phoneParts: { countryCallCode: string; localPhoneNumber: string }
    try {
        phoneParts = getCountryCallCodeFromString(withoutLeadingPlus)
    } catch (e) {
        return [value]
    }
    return [
        value,
        `+${phoneParts.countryCallCode}0${phoneParts.localPhoneNumber}`,
    ]
}

/*
this function both cleans and validates
and will throw errors for invalid numbers

If you're already doing validation seperatly
and don't want to throw more errors
or you want invalid values to default to undefined
call with `throwErrors=true`
If your using this function to validate `value`
or know that `value` is already valid
call with `throwErrors=false`
*/
function cleanPhone(
    value: string | undefined | null,
    throwErrors = true
): string | undefined | null {
    value = contactInfo(value)

    if (value === undefined || value === null) {
        return value
    }

    try {
        return normalizePhoneNumber(value)
    } catch (e) {
        if (throwErrors) {
            throw e
        } else {
            return undefined
        }
    }
}

function contactInfo(value: string | null | undefined) {
    if (value === null || value === '') return null
    if (typeof value === 'undefined') return undefined
    return normalizedLowercaseTrimmed(value)
}

export default {
    email: function <V extends string | null | undefined>(value: V) {
        return contactInfo(value)
    },
    phone: cleanPhone,

    /**
     *
     * @param value unclean shortcode input
     * @returns uppercased shortcode
     */
    shortcode: function <V>(value: V): string | V {
        if (typeof value === 'string') {
            return value.toUpperCase()
        }
        return value
    },
    /**
     *
     * @param value unclean date_of_birth input
     * @returns dateOfBirth with leading 0 added
     */
    dateOfBirth: function <V>(value: V): string | V {
        if (typeof value === 'string' && value.length > 0 && value.length < 7) {
            return `0${value}`
        }
        return value
    },
}
