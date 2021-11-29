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
    if (email !== null && !isEmail(email) && isPhone(email)) {
        phone = email
        email = undefined
    } else if (phone !== null && !isPhone(phone) && isEmail(phone)) {
        email = phone
        phone = undefined
    }

    return { email, phone }
}

export default {
    contactInfo: function (value: string | null | undefined) {
        if (value === null || value === '') return null
        if (typeof value === 'undefined') return undefined
        return normalizedLowercaseTrimmed(value)
    },

    email: function <V extends string | null | undefined>(value: V) {
        return this.contactInfo(value)
    },

    phone: function (value: string | null | undefined) {
        return this.contactInfo(value)
    },
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
