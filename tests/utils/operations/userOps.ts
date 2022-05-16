import { expect } from 'chai'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { User } from '../../../src/entities/user'
import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'
import { getAdminAuthToken } from '../testConfig'
import { Headers } from 'node-mocks-http'
import { Subject } from '../../../src/entities/subject'
import {
    UsersMutationResult,
    UserContactInfo,
    CreateUserInput,
} from '../../../src/types/graphQL/user'
import { UpdateUserInput } from '../../../src/types/graphQL/user'
import faker from 'faker'

export const CREATE_ORGANIZATION = `
    mutation myMutation($user_id: ID!, $organization_name: String, $shortCode: String) {
        user(user_id: $user_id) {
            createOrganization(organization_name: $organization_name, shortCode: $shortCode) {
                organization_id
                organization_name
                shortCode
                status
            }
        }
    }
`

const ADD_ORGANIZATION_TO_USER = `
    mutation myMutation($user_id: ID!, $organization_id: ID!) {
        user(user_id: $user_id) {
            addOrganization(organization_id: $organization_id) {
                user_id
                organization_id
            }
        }
    }
`

const SET = `
    mutation myMutation(
            $user_id: ID!
            $given_name: String,
            $family_name: String,
            $username: String
            $date_of_birth: String,
            $gender: String,
            $avatar: String,
            $alternate_email: String,
            $alternate_phone: String) {
        user(user_id: $user_id) {
            set(
                given_name: $given_name
                family_name: $family_name
                username: $username
                date_of_birth: $date_of_birth
                gender: $gender
                avatar: $avatar
                alternate_email: $alternate_email
                alternate_phone: $alternate_phone
            ) {
                given_name
                family_name
                username
                date_of_birth
                gender
                avatar
                alternate_email
                alternate_phone
            }
        }
    }
`

const SET_EMAIL = `
    mutation myMutation(
            $user_id: ID!
            $email: String) {
        user(user_id: $user_id) {
            set(
                email: $email
            ) {
                email
            }
        }
    }
`

const SET_PRIMARY = `
    mutation myMutation($user_id: ID!) {
        user(user_id: $user_id) {
            setPrimary
        }
    }
`

const GET_PRIMARY = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            primary
        }
    }
`

const GET_ORGANIZATION_MEMBERSHIPS = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            memberships {
                user_id
                organization_id
            }
        }
    }
`

const GET_ORGANIZATION_MEMBERSHIP = `
    query myQuery(
            $user_id: ID!,
            $organization_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                user_id
                organization_id
            }
        }
    }
`

const GET_SCHOOL_MEMBERSHIPS = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            school_memberships {
                user_id
                school_id
            }
        }
    }
`

export const GET_SCHOOL_MEMBERSHIPS_WITH_ORG = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            school_memberships {
                school {
                    organization {
                        organization_id
                    }
                }
            }
        }
    }
`

const GET_SCHOOL_MEMBERSHIP = `
    query myQuery(
            $user_id: ID!,
            $school_id: ID!) {
        user(user_id: $user_id) {
            school_membership(school_id: $school_id) {
                user_id
                school_id
            }
        }
    }
`

const GET_CLASSES_TEACHING = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            classesTeaching {
                class_id
            }
        }
    }
`

const GET_CLASSES_STUDYING = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            classesStudying {
                class_id
            }
        }
    }
`

const GET_SUBJECTS_TEACHING = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            subjectsTeaching {
                id
                name
                system
                status
            }
        }
    }
`

const GET_SCHOOL_MEMBERSHIPS_WITH_PERMISSION = `
    query myQuery($user_id: ID!, $permission_name: String!) {
        user(user_id: $user_id) {
            schoolsWithPermission(permission_name: $permission_name) {
                user_id
                school_id
            }
        }
    }
`

const MERGE_USER = `
mutation myMutation($user_id: ID!, $other_id: String) {
    user(user_id: $user_id) {
        merge(other_id: $other_id) {
            user_id
            given_name
            family_name
            avatar
            memberships{
                user_id
                organization_id
            }
            school_memberships{
                user_id
                school_id
            }
            classesStudying{
                class_id
            }
            classesTeaching{
                class_id
            }
        }
    }
}
`

const ADD_SCHOOL = `
    mutation myMutation($user_id: ID!, $school_id: ID!) {
        user(user_id: $user_id) {
            addSchool(school_id: $school_id) {
                user_id
                school_id
            }
        }
    }
`

const USERS_MUTATION_RESULT_CORE = `users {
    id
    givenName
    familyName
    avatar
    contactInfo {
        email
        phone
    }
    alternateContactInfo {
        email
        phone
    }
    status
    dateOfBirth
    username
    gender
}
`

const USERS_MUTATION_RESULT = `users {
                id
                givenName
                familyName
                avatar
                contactInfo {
                    email
                    phone
                }
                alternateContactInfo {
                    email
                    phone
                }
                organizations {
                    id
                    name
                    joinDate
                    status
                    userShortCode
                }
                roles {
                    id
                    name
                    organizationId
                    schoolId
                    status
                }
                schools {
                    id
                    name
                    organizationId
                    status
                }
                status
                dateOfBirth
                username
                gender
            }`

export const ADD_ORG_ROLES_TO_USERS = `
    mutation myMutation($input: [AddOrganizationRolesToUserInput!]!) {
        addOrganizationRolesToUsers(input: $input) {
            ${USERS_MUTATION_RESULT}
        }
    }
`

export const CREATE_USERS = `
    mutation CreateUsers($input:[CreateUserInput!]!){
        createUsers(input:$input) {
            ${USERS_MUTATION_RESULT}
        }
    }
`

export const REMOVE_ORG_ROLES_FROM_USERS = `
    mutation myMutation($input: [RemoveOrganizationRolesFromUserInput!]!) {
        removeOrganizationRolesFromUsers(input: $input) {
            ${USERS_MUTATION_RESULT}
        }
    }
`

export const UPDATE_USERS = `
   mutation UpdateUsers($input:[UpdateUserInput!]!){
        updateUsers(input:$input){
            ${USERS_MUTATION_RESULT}
        }
    }
`

export const ADD_SCHOOL_ROLES_TO_USERS = `
mutation myMutation($input: [AddSchoolRolesToUserInput!]!) {
    addSchoolRolesToUsers(input: $input) {
        ${USERS_MUTATION_RESULT_CORE}
    }
}
`

export const REMOVE_SCHOOL_ROLES_FROM_USERS = `
    mutation myMutation($input: [RemoveSchoolRolesFromUserInput!]!) {
        removeSchoolRolesFromUsers(input: $input) {
            ${USERS_MUTATION_RESULT}
        }
    }
`

export async function createOrganizationAndValidate(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationName?: string,
    shortCode?: string,
    token?: string
): Promise<Organization> {
    organizationName = organizationName ?? 'My Organization'
    const gqlOrganization = await createOrganization(
        testClient,
        userId,
        organizationName,
        shortCode,
        token
    )

    expect(gqlOrganization).to.exist
    const dbOrganization = await Organization.findOneOrFail({
        where: { organization_name: organizationName },
    })
    expect(dbOrganization).to.include(gqlOrganization)

    return dbOrganization
}

export async function createOrganization(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationName: string,
    shortCode?: string,
    token?: string
): Promise<Organization> {
    token = token ?? getAdminAuthToken()
    const variables = {
        user_id: userId,
        organization_name: organizationName,
    } as any

    if (shortCode) {
        variables.shortCode = shortCode
    }
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: CREATE_ORGANIZATION,
            variables: variables,
            headers: { authorization: token },
        })

    const res = await gqlTry(operation)
    const gqlOrganization = res.data?.user.createOrganization as Organization
    return gqlOrganization
}

export async function addOrganizationToUserAndValidate(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    token?: string
) {
    const gqlMembership = await addOrganizationToUser(
        testClient,
        userId,
        organizationId,
        token
    )

    const dbUser = await User.findOneOrFail({ where: { user_id: userId } })
    const dbOrganization = await Organization.findOneOrFail({
        where: { organization_id: organizationId },
    })
    const dbOrganizationMembership = await OrganizationMembership.findOneOrFail(
        { where: { user_id: userId, organization_id: organizationId } }
    )

    const userMemberships = await dbUser.memberships
    const organizationMemberships = await dbOrganization.memberships

    expect(gqlMembership).to.exist
    expect(gqlMembership.user_id).equals(userId)
    expect(gqlMembership.organization_id).equals(organizationId)
    expect(userMemberships).to.deep.include(dbOrganizationMembership)
    expect(organizationMemberships).to.deep.include(dbOrganizationMembership)

    return gqlMembership
}

export async function addOrganizationToUser(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    token?: string
) {
    const { mutate } = testClient

    token = token ?? getAdminAuthToken()

    const operation = () =>
        mutate({
            mutation: ADD_ORGANIZATION_TO_USER,
            variables: { user_id: userId, organization_id: organizationId },
            headers: { authorization: token },
        })

    const res = await gqlTry(operation)
    const gqlMembership = res.data?.user
        .addOrganization as OrganizationMembership
    return gqlMembership
}

export async function updateUser(
    testClient: ApolloServerTestClient,
    user: User,
    headers?: Headers
) {
    const { mutate } = testClient
    const userMods = {
        given_name: 'Billy',
        family_name: 'Bob',
        username: 'Big Ears',
        avatar: 'new_avatar',
        date_of_birth: '03-1983',
        gender: 'Male',
        alternate_email: 'al@some.com',
        alternate_phone: '+123456789',
    }

    const operation = () =>
        mutate({
            mutation: SET,
            variables: { user_id: user.user_id, ...userMods },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUser = res.data?.user.set as User
    return gqlUser
}

export async function updateUserEmail(
    testClient: ApolloServerTestClient,
    user: User,
    email: string,
    headers?: Headers
) {
    const { mutate } = testClient
    const userMod = { email }

    const operation = () =>
        mutate({
            mutation: SET_EMAIL,
            variables: { user_id: user.user_id, ...userMod },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUser = res.data?.user as User
    return gqlUser
}

export async function setPrimaryUser(
    testClient: ApolloServerTestClient,
    user: User,
    headers?: Headers
) {
    const { mutate, query } = testClient

    const mutationOperation = () =>
        mutate({
            mutation: SET_PRIMARY,
            variables: { user_id: user.user_id },
            headers: headers,
        })
    await gqlTry(mutationOperation)

    const queryOperation = () =>
        query({
            query: GET_PRIMARY,
            variables: { user_id: user.user_id },
            headers: headers,
        })
    const res = await gqlTry(queryOperation)

    const gqlUser = res.data?.user as User
    return gqlUser
}

export async function getOrganizationMemberships(
    testClient: ApolloServerTestClient,
    user: User,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_ORGANIZATION_MEMBERSHIPS,
            variables: { user_id: user.user_id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMemberships = res.data?.user
        .memberships as OrganizationMembership[]
    return gqlMemberships
}

export async function getOrganizationMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_ORGANIZATION_MEMBERSHIP,
            variables: { user_id: userId, organization_id: organizationId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMembership = res.data?.user.membership as OrganizationMembership
    return gqlMembership
}

export async function getSchoolMemberships(
    testClient: ApolloServerTestClient,
    userId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_SCHOOL_MEMBERSHIPS,
            variables: { user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMemberships = res.data?.user
        .school_memberships as SchoolMembership[]
    return gqlMemberships
}

export async function getSchoolMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_SCHOOL_MEMBERSHIP,
            variables: { user_id: userId, school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMembership = res.data?.user.school_membership as SchoolMembership
    return gqlMembership
}

export async function getClassesTeaching(
    testClient: ApolloServerTestClient,
    userId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_CLASSES_TEACHING,
            variables: { user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlClasses = res.data?.user.classesTeaching as Class[]
    return gqlClasses
}

export async function getClassesStudying(
    testClient: ApolloServerTestClient,
    userId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_CLASSES_STUDYING,
            variables: { user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlClasses = res.data?.user.classesStudying as Class[]
    return gqlClasses
}

export async function getUserSchoolMembershipsWithPermission(
    testClient: ApolloServerTestClient,
    userId: string,
    permissionName: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_SCHOOL_MEMBERSHIPS_WITH_PERMISSION,
            variables: { user_id: userId, permission_name: permissionName },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMemberships = res.data?.user
        .schoolsWithPermission as SchoolMembership[]
    return gqlMemberships
}

export type MergeUserResponse = {
    user_id: string
    given_name: string
    family_name: string
    avatar: string
    memberships: {
        user_id: string
        organization_id: string
    }[]
    school_memberships: {
        user_id: string
        school_id: string
    }[]
    classesStudying: {
        class_id: string
    }[]
    classesTeaching: {
        class_id: string
    }[]
} | null

export async function mergeUser(
    testClient: ApolloServerTestClient,
    userId: string,
    otherId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    headers = headers ?? { authorization: getAdminAuthToken() }
    const operation = () =>
        mutate({
            mutation: MERGE_USER,
            variables: { user_id: userId, other_id: otherId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUser = res.data?.user.merge as MergeUserResponse
    return gqlUser
}

export function userToSuperPayload(user: User): any {
    return {
        id: user.user_id,
        email: user.email,
        given_name: user.given_name,
        family_name: user.family_name,
        name: user.user_name,
        admin: true,
        iss: 'calmid-debug',
    }
}

export function userToPayload(user: User, username = false): any {
    const payload = {
        email: user.email,
        phone: user.phone,
        given_name: user.given_name,
        family_name: user.family_name,
        iss: 'calmid-debug',
    } as any
    if (username) {
        payload.user_name = user.username
    }
    if (user.user_id) {
        payload.id = user.user_id
    }
    return payload
}

export async function getSubjectsTeaching(
    testClient: ApolloServerTestClient,
    userId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_SUBJECTS_TEACHING,
            variables: { user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubjects = res.data?.user.subjectsTeaching as Subject[]
    return gqlSubjects
}

export async function addSchoolToUser(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: ADD_SCHOOL,
            variables: { user_id: userId, school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMembership = res.data?.user.addSchool as SchoolMembership
    return gqlMembership
}

export async function createGqlUsers(
    testClient: ApolloServerTestClient,
    input: CreateUserInput[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: CREATE_USERS,
            variables: { input },
            headers: headers,
        })
    const res = await gqlTry(operation)
    const gqlUsersResult = res.data?.createUsers as UsersMutationResult
    return gqlUsersResult
}

export async function updateGqlUsers(
    testClient: ApolloServerTestClient,
    input: UpdateUserInput[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: UPDATE_USERS,
            variables: { input },
            headers: headers,
        })
    const res = await gqlTry(operation)
    const gqlUsersResult = res.data?.updateUsers as UsersMutationResult
    return gqlUsersResult
}

export function userToCreateUserInput(u: User): CreateUserInput {
    const ci: UserContactInfo = {
        email: u.email,
        phone: u.phone,
    }
    const cui: CreateUserInput = {
        givenName: u.given_name ? u.given_name : '',
        familyName: u.family_name ? u.family_name : '',
        contactInfo: ci,
        gender: u.gender ? u.gender : '',
        dateOfBirth: u.date_of_birth,
        username: u.username,
        alternateEmail: u.alternate_email,
        alternatePhone: u.alternate_phone,
    }
    return cui
}

export function userToUpdateUserInput(u: User): UpdateUserInput {
    const uui: UpdateUserInput = {
        id: u.user_id,
        email: u.email,
        phone: u.phone,
        givenName: u.given_name ? u.given_name : '',
        familyName: u.family_name ? u.family_name : '',
        gender: u.gender ? u.gender : '',
        dateOfBirth: u.date_of_birth,
        username: u.username,
        alternateEmail: u.alternate_email || undefined,
        alternatePhone: u.alternate_phone || undefined,
    }
    return uui
}

export function randomChangeToUpdateUserInput(
    u: UpdateUserInput
): UpdateUserInput {
    const choice = faker.datatype.number(8)
    switch (choice) {
        case 0:
            u.givenName = faker.name.firstName()
            break
        case 1:
            u.familyName = faker.name.lastName()
            break
        case 2:
            u.gender = u.gender == 'Female' ? 'Male' : 'Female'
            break
        case 3:
            {
                const month = faker.datatype.number({
                    min: 1,
                    max: 12,
                    precision: 1,
                })

                u.dateOfBirth =
                    (month < 10 ? '0' : '') +
                    month +
                    '-' +
                    faker.datatype.number({ min: 1950, max: 2021 })
            }
            break
        case 4:
            u.username = faker.name.firstName()
            break
        case 5:
            u.alternateEmail = faker.internet.email()
            break
        case 6:
            u.alternatePhone = faker.phone.phoneNumber('+44#######')
            break
        case 7:
            u.avatar = faker.internet.url()
            break
        case 8:
            u.primaryUser = u.primaryUser ? false : true
            break
        default:
            throw new Error('bad choice')
    }
    return u
}
