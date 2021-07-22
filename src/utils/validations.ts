import { REGEX } from '../entities/validations/regex'

//
// TODO
// Deprecate and use Joi.based validation

export function validateEmail(email?: string): boolean {
    if (email !== undefined && email.match(REGEX.email)) {
        return true
    }
    return false
}

export function validatePhone(phone?: string): boolean {
    if (phone !== undefined && phone.match(REGEX.phone)) {
        return true
    }
    return false
}

export function validateDOB(dob?: string): boolean {
    if (dob !== undefined && dob.match(REGEX.dob)) {
        return true
    }
    return false
}
