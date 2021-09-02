import { normalizedLowercaseTrimmed } from '../entities/organization'

export default {
    contactInfo: function (value?: string | null) {
        if (value === null || value === '') return null
        if (typeof value === 'undefined') return undefined
        return normalizedLowercaseTrimmed(value)
    },

    email: function (value?: string | null) {
        return this.contactInfo(value)
    },

    phone: function (value?: string | null) {
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
