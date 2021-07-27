import { REGEX } from '../../entities/validations/regex'

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
