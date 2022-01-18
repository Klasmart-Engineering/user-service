import { ApolloServerTestClient } from '../createTestClient'
import { Headers } from 'node-mocks-http'
import { gqlTry } from '../gqlTry'
import { getAdminAuthToken } from '../testConfig'
import { Role } from '../../../src/entities/role'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { User } from '../../../src/entities/user'

export const ADD_ROLE_TO_ORGANIZATION_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $organization_id: ID!
            $role_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                addRole(role_id: $role_id) {
                    role_id
                    role_name
                }
            }
        }
    }
`

const ADD_ROLES_TO_ORGANIZATION_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $organization_id: ID!
            $role_ids: [ID!]!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                addRoles(role_ids: $role_ids) {
                    role_id
                    role_name
                }
            }
        }
    }
`

const REMOVE_ROLE_TO_ORGANIZATION_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $organization_id: ID!
            $role_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                removeRole(role_id: $role_id) {
                    user_id
                    organization_id
                }
            }
        }
    }
`

const GET_SCHOOL_MEMBERSHIPS = `
    query myQuery(
            $user_id: ID!
            $organization_id: ID!
            $permission_name: String) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                schoolMemberships(permission_name: $permission_name) {
                    user_id
                    school_id
                    school {
                        school_name
                    }
                }
            }
        }
    }
`

export const LEAVE_ORGANIZATION = `
    mutation myMutation( $user_id: ID!  $organization_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                leave
            }
        }
    }
`

const GET_CLASSES_TEACHING = `
    query myQuery($user_id: ID!, $organization_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                classesTeaching {
                    class_id
                }
            }
        }
    }
`

export async function addRoleToOrganizationMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    roleId: string,
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: ADD_ROLE_TO_ORGANIZATION_MEMBERSHIP,
            variables: {
                user_id: userId,
                organization_id: organizationId,
                role_id: roleId,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.user.membership.addRole as Role
}

export async function addRolesToOrganizationMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    roleIds: string[],
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: ADD_ROLES_TO_ORGANIZATION_MEMBERSHIP,
            variables: {
                user_id: userId,
                organization_id: organizationId,
                role_ids: roleIds,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.user.membership.addRoles as Role[]
}

export async function removeRoleToOrganizationMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    roleId: string,
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: REMOVE_ROLE_TO_ORGANIZATION_MEMBERSHIP,
            variables: {
                user_id: userId,
                organization_id: organizationId,
                role_id: roleId,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.user.membership.removeRole as OrganizationMembership
}

export async function getSchoolMembershipsForOrganizationMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    permission_name?: string,
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    if (permission_name !== undefined) {
        const operation = () =>
            mutate({
                mutation: GET_SCHOOL_MEMBERSHIPS,
                variables: {
                    user_id: userId,
                    organization_id: organizationId,
                    permission_name: permission_name,
                },
                headers: headers,
            })
        const res = await gqlTry(operation)
        return res.data?.user.membership.schoolMemberships as SchoolMembership[]
    } else {
        const operation = () =>
            mutate({
                mutation: GET_SCHOOL_MEMBERSHIPS,
                variables: { user_id: userId, organization_id: organizationId },
                headers: headers,
            })
        const res = await gqlTry(operation)
        return res.data?.user.membership.schoolMemberships as SchoolMembership[]
    }
}

export async function leaveOrganization(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    headers?: Headers
) {
    const { mutate } = testClient
    headers = headers ?? { authorization: getAdminAuthToken() }

    const operation = () =>
        mutate({
            mutation: LEAVE_ORGANIZATION,
            variables: { user_id: userId, organization_id: organizationId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.user.membership.leave as boolean
}

export async function getClassesTeachingViaOrganizationMembership(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_CLASSES_TEACHING,
            variables: { user_id: userId, organization_id: organizationId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlClasses = res.data?.user.membership.classesTeaching as Class[]
    return gqlClasses
}
