export interface ContactInfoInput {
    email?: string | null
    phone?: string | null
}

export interface CreateUserInput {
    givenName: string
    familyName: string
    contactInfo: ContactInfoInput
    dateOfBirth?: string
    username?: string
    gender: string
    alternateEmail?: string | null
    alternatePhone?: string | null
}
