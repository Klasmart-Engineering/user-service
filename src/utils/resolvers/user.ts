import { User } from '../../entities/user'
import {
    CreateUserInput,
    UpdateUserInput,
    UserContactInfo,
} from '../../types/graphQL/user'
import clean from '../clean'

export type ConflictingUserKey = {
    givenName: string
    familyName: string
    username?: string
    email?: string
    phone?: string
}

export type OrganizationMembershipKey = {
    organizationId: string
    userId: string
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
 * Transforms the given UpdateUserInput in a ConflictingUserKey
 */
export function updateUserInputToConflictingUserKey(
    input: UpdateUserInput,
    usersMap: Map<string, User>
): ConflictingUserKey {
    const { id, givenName, familyName, username, email, phone } = input
    const user = usersMap.get(id)
    return {
        givenName: givenName || user?.given_name || '',
        familyName: familyName || user?.family_name || '',
        username: username || user?.username,
        email: email || user?.email,
        phone: phone || user?.phone,
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
 * Normalizes and clean the input fields using the "clean.xxxx()" calls
 */
export function cleanUpdateUserInput(uui: UpdateUserInput): UpdateUserInput {
    const cleanUui: UpdateUserInput = {
        id: uui.id,
        email: clean.email(uui.email) || undefined,
        // don't throw errors as they will of already been
        // found by validation but this code runs before we return them
        phone: clean.phone(uui.phone, false) || undefined,
        givenName: uui.givenName,
        familyName: uui.familyName,
        gender: uui.gender,
        username: uui.username,
        dateOfBirth: clean.dateOfBirth(uui.dateOfBirth),
        alternateEmail: clean.email(uui.alternateEmail) || undefined,
        // don't throw errors as they will of already been
        // found by validation but this code runs before we return them
        alternatePhone: clean.phone(uui.alternatePhone, false) || undefined,
        avatar: uui.avatar,
        primaryUser: uui.primaryUser,
    }
    return cleanUui
}
