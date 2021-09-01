import { normalizedLowercaseTrimmed } from '../entities/organization'

export default {
    contactInfo: function (
        value?: string | null
    ) {
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
}
