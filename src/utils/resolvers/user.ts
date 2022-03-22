import { CreateUserInput, UserContactInfo } from '../../types/graphQL/user'
import clean from '../clean'

export type ConflictingUserKey = {
    givenName: string
    familyName: string
    username?: string
    email?: string
    phone?: string
}

/**
 * Transforms the given CreateUserInput in a ConflictingUserKey
 */
export function createUserInputToConflictingUserKey(
    input: CreateUserInput
): ConflictingUserKey {
    const { givenName, familyName, username, contactInfo } = input
    return {
        givenName,
        familyName,
        username: username || undefined,
        email: contactInfo?.email || undefined,
        phone: contactInfo?.phone || undefined,
    }
}

/**
 * Builds a ConflictingUserKey taking the transformed CreateUserInput.
 * This key is built taking givenName, familyName and the first existing value of the following fields in that order: (username, email, phone)
 */
export function buildConflictingUserKey(
    inputValues: ConflictingUserKey
): ConflictingUserKey {
    const { givenName, familyName, username, email, phone } = inputValues
    const key = {
        givenName,
        familyName,
        ...addIdentifierToKey(username, email, phone),
    }

    return key
}

/**
 * Returns in an Object like format the first value found between (username, email, phone)
 */
export function addIdentifierToKey(
    username?: string,
    email?: string,
    phone?: string
) {
    if (username) return { username }
    else if (email) return { email }
    else if (phone) return { phone }
}

/**
 * Uses the same "clean.xxxx()" calls as the csv functions do
 */
export function cleanCreateUserInput(cui: CreateUserInput): CreateUserInput {
    const ci: UserContactInfo | undefined = cui.contactInfo
        ? {
              email: clean.email(cui.contactInfo.email),
              // don't throw errors as they will of already been
              // found by validation but this code runs before we return them
              phone: clean.phone(cui.contactInfo.phone, false),
          }
        : undefined

    const cleanCui: CreateUserInput = {
        givenName: cui.givenName,
        familyName: cui.familyName,
        contactInfo: ci,
        gender: cui.gender,
        dateOfBirth: clean.dateOfBirth(cui.dateOfBirth),
        username: cui.username,
        alternateEmail: clean.email(cui.alternateEmail),
        // don't throw errors as they will of already been
        // found by validation but this code runs before we return them
        alternatePhone: clean.phone(cui.alternatePhone, false),
    }
    return cleanCui
}

/**
 * We build a key for a map, I am using maps to reduce the looping through arrays to
 * a minimum when looking up values
 */
export function makeLookupKey(
    given: string | undefined | null,
    family: string | undefined | null,
    contact: string | undefined | null
): string {
    const jsonKey = {
        contactInfo: contact,
        givenName: given,
        familyName: family,
    }
    return JSON.stringify(jsonKey)
}
