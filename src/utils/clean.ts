import { normalizedLowercaseTrimmed } from '../entities/organization'
import { isEmail, isPhone } from './validations'

export default {
    contactInfo: function (
        isValid: (v?: string) => boolean,
        value?: string | null
    ) {
        if (value === null || value === '') return null
        if (typeof value === 'undefined') return undefined
        const normalized = normalizedLowercaseTrimmed(value)
        if (isValid(normalized)) return normalized
    },

    email: function (value?: string | null) {
        return this.contactInfo(isEmail, value)
    },

    phone: function (value?: string | null) {
        return this.contactInfo(isPhone, value)
    },
}
