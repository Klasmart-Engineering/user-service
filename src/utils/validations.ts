export function validateEmail(email?: string): boolean {
    const email_re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    if (email !== undefined && email.match(email_re)) {
        return true
    }
    return false
}

export function validatePhone(phone?: string): boolean {
    const phone_re = /^\++?[1-9][0-9]\d{6,14}$/
    if (phone !== undefined && phone.match(phone_re)) {
        return true
    }
    return false
}

export function validateDOB(dob?: string): boolean {
    const dob_re = /^(((0)[0-9])|((1)[0-2]))(-)\d{4}$/
    if (dob !== undefined && dob.match(dob_re)) {
        return true
    }
    return false
}

export function validateSubjectName(name?: string): boolean {
    const subject_name_re = /^[\p{L}0-9 &\/,-]+$/gu

    if (name && name.match(subject_name_re)) {
        return true
    }
    return false
}
