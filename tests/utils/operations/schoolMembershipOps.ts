import { ApolloServerTestClient } from '../createTestClient'
import { Headers } from 'node-mocks-http'
import { gqlTry } from '../gqlTry'
import { getAdminAuthToken } from '../testConfig'
import { Role } from '../../../src/entities/role'
import { SchoolMembership } from '../../../src/entities/schoolMembership'

const ADD_ROLE_TO_SCHOOL_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $school_id: ID!
            $role_id: ID!) {
        user(user_id: $user_id) {
            school_membership(school_id: $school_id) {
                addRole(role_id: $role_id) {
                    role_id
                    role_name
                }
            }
        }
    }
`

const ADD_ROLES_TO_SCHOOL_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $school_id: ID!
            $role_ids: [ID!]!) {
        user(user_id: $user_id) {
            school_membership(school_id: $school_id) {
                addRoles(role_ids: $role_ids) {
                    role_id
                    role_name
                }
            }
        }
    }
`

const REMOVE_ROLE_TO_SCHOOL_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $school_id: ID!
            $role_id: ID!) {
        user(user_id: $user_id) {
            school_membership(school_id: $school_id) {
                removeRole(role_id: $role_id) {
                    school_id
                    user_id
                }
            }
        }
    }
`

const LEAVE_SCHOOL = `
mutation myMutation($user_id: ID!  $school_id: ID!){
  user(user_id: $user_id) {
    school_membership(school_id: $school_id) {
      leave
    }
  }
}
`

const CHECK_ALLOWED = `
query myQuery($user_id: ID!  $school_id: ID!, $permission_name: ID!){
    user(user_id: $user_id) {
        school_membership(school_id: $school_id) {
            checkAllowed(permission_name: $permission_name)
        }
    }
}
`

export async function addRoleToSchoolMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    roleId: string,
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: ADD_ROLE_TO_SCHOOL_MEMBERSHIP,
            variables: {
                user_id: userId,
                school_id: schoolId,
                role_id: roleId,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlRole = res.data?.user.school_membership.addRole as Role
    return gqlRole
}

export async function addRolesToSchoolMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    roleIds: string[],
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: ADD_ROLES_TO_SCHOOL_MEMBERSHIP,
            variables: {
                user_id: userId,
                school_id: schoolId,
                role_ids: roleIds,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlRoles = res.data?.user.school_membership.addRoles as Role[]
    return gqlRoles
}

export async function removeRoleToSchoolMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    roleId: string,
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: REMOVE_ROLE_TO_SCHOOL_MEMBERSHIP,
            variables: {
                user_id: userId,
                school_id: schoolId,
                role_id: roleId,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMembership = res.data?.user.school_membership
        .removeRole as SchoolMembership
    return gqlMembership
}

export async function leaveSchool(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: LEAVE_SCHOOL,
            variables: { user_id: userId, school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const leaveResult = res.data?.user.school_membership.leave as boolean
    return leaveResult
}

export async function schoolMembershipCheckAllowed(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    permissionName: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: CHECK_ALLOWED,
            variables: {
                user_id: userId,
                school_id: schoolId,
                permission_name: permissionName,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const isAllowed = res.data?.user.school_membership.checkAllowed as boolean
    return isAllowed
}
