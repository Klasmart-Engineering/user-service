import { REGEX } from '../entities/validations/regex'

// NB: Should use Joi if validation is required.
// These are utilities to detect if an arbitrary string is an email/phone/DOB

export function isEmail(email?: string): boolean {
    if (email !== undefined && email.match(REGEX.email)) {
        return true
    }
    return false
}

export function isPhone(phone?: string): boolean {
    if (phone !== undefined && phone.match(REGEX.phone)) {
        return true
    }
    return false
}

export function isDOB(dob?: string): boolean {
    if (dob !== undefined && dob.match(REGEX.dob)) {
        return true
    }
    return false
}
