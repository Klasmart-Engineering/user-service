import { ApolloServerTestClient } from '../createTestClient'
import { Headers } from 'node-mocks-http'
import { gqlTry } from '../gqlTry'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { School } from '../../../src/entities/school'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { Class } from '../../../src/entities/class'
import { DeleteSchoolInput } from '../../../src/types/graphQL/school'
import gql from 'graphql-tag'

const GET_ORGANIZATION = `
    query myQuery($school_id: ID!) {
        school(school_id: $school_id) {
            organization {
                organization_id
                organization_name
            }
        }
    }
`

const GET_CLASSES = `
    query myQuery($school_id: ID!) {
        school(school_id: $school_id) {
            classes {
                class_id
                class_name
            }
        }
    }
`

const GET_MEMBERSHIPS = `
    query myQuery($school_id: ID!) {
        school(school_id: $school_id) {
            memberships {
                user_id
                school_id
                user{
                    user_id
                }
            }
        }
    }
`

const GET_MEMBERSHIP = `
    query myQuery(
            $school_id: ID!
            $user_id: ID!) {
        school(school_id: $school_id) {
            membership(user_id: $user_id) {
                user_id
                school_id
            }
        }
    }
`

const UPDATE_SCHOOL = `
    mutation myMutation(
            $school_id: ID!
            $school_name: String
            $shortcode: String) {
        school(school_id: $school_id) {
            set(school_name: $school_name, shortcode: $shortcode) {
                school_id
                school_name
                shortcode
            }
        }
    }
`

const ADD_USER_TO_SCHOOL = `
    mutation myMutation(
            $user_id: ID!
            $school_id: ID!) {
        school(school_id: $school_id) {
            addUser(user_id: $user_id) {
                user_id
                school_id
            }
        }
    }
`

const LIST_PROGRAMS = `
    mutation listPrograms($id: ID!) {
       school(school_id: $id) {
          programs {
            id
            name
            system
          }
       }
    }
`

const EDIT_PROGRAM = `
    mutation editProgramClass($id: ID!, $program_ids: [ID!]) {
       school(school_id: $id) {
          editPrograms(program_ids: $program_ids) {
            id
            name
          }
       }
    }
`

const DELETE_SCHOOL = `
    mutation myMutation($school_id: ID!) {
        school(school_id: $school_id) {
            delete
        }
    }
`

const SCHOOL_FIELDS = gql`
    fragment schoolFields on SchoolConnectionNode {
        id
        name
        status
        shortCode
    }
`

export const REMOVE_PROGRAMS_FROM_SCHOOLS = gql`
    ${SCHOOL_FIELDS}
    mutation myMutation($input: [RemoveProgramsFromSchoolInput!]!) {
        removeProgramsFromSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export const DELETE_SCHOOLS = gql`
    ${SCHOOL_FIELDS}

    mutation deleteSchools($input: [DeleteSchoolInput!]!) {
        deleteSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export const ADD_CLASSES_TO_SCHOOLS = gql`
    ${SCHOOL_FIELDS}

    mutation myMutation($input: [AddClassesToSchoolInput!]!) {
        addClassesToSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export const ADD_PROGRAMS_TO_SCHOOLS = gql`
    ${SCHOOL_FIELDS}
    mutation myMutation($input: [AddProgramsToSchoolInput!]!) {
        addProgramsToSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export const CREATE_SCHOOLS = gql`
    ${SCHOOL_FIELDS}

    mutation createSchools($input: [CreateSchoolInput!]!) {
        createSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export const UPDATE_SCHOOLS = gql`
    ${SCHOOL_FIELDS}

    mutation updateSchools($input: [UpdateSchoolInput!]!) {
        updateSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export const ADD_USERS_TO_SCHOOLS = gql`
    ${SCHOOL_FIELDS}

    mutation addUsersToSchools($input: [AddUsersToSchoolInput!]!) {
        addUsersToSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export const REMOVE_USERS_FROM_SCHOOLS = gql`
    ${SCHOOL_FIELDS}

    mutation removeUsersFromSchools($input: [RemoveUsersFromSchoolInput!]!) {
        removeUsersFromSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`
export const REMOVE_CLASSES_FROM_SCHOOLS = gql`
    ${SCHOOL_FIELDS}

    mutation myMutation($input: [RemoveClassesFromSchoolInput!]!) {
        removeClassesFromSchools(input: $input) {
            schools {
                ...schoolFields
            }
        }
    }
`

export async function getSchoolOrganization(
    testClient: ApolloServerTestClient,
    schoolId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_ORGANIZATION,
            variables: { school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlOrganization = res.data?.school.organization as Organization
    return gqlOrganization
}

export async function getSchoolClasses(
    testClient: ApolloServerTestClient,
    schoolId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_CLASSES,
            variables: { school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlClasses = res.data?.school.classes as Class[]
    return gqlClasses
}

export async function getSchoolMembershipsViaSchool(
    testClient: ApolloServerTestClient,
    schoolId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_MEMBERSHIPS,
            variables: { school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMemberships = res.data?.school.memberships as SchoolMembership[]
    return gqlMemberships
}

export async function getSchoolMembershipViaSchool(
    testClient: ApolloServerTestClient,
    schoolId: string,
    userId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_MEMBERSHIP,
            variables: { school_id: schoolId, user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMembership = res.data?.school.membership as SchoolMembership
    return gqlMembership
}

export async function updateSchool(
    testClient: ApolloServerTestClient,
    schoolId: string,
    schoolName: string,
    shortCode?: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const variables = { school_id: schoolId, school_name: schoolName } as any
    if (shortCode) {
        variables.shortcode = shortCode
    }
    const operation = () =>
        mutate({
            mutation: UPDATE_SCHOOL,
            variables: variables,
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSchool = res.data?.school.set as School
    return gqlSchool
}

export async function addUserToSchool(
    testClient: ApolloServerTestClient,
    userId: string,
    schoolId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: ADD_USER_TO_SCHOOL,
            variables: { user_id: userId, school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlMembership = res.data?.school.addUser as SchoolMembership
    return gqlMembership
}

export async function deleteSchool(
    testClient: ApolloServerTestClient,
    schoolId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: DELETE_SCHOOL,
            variables: { school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSchool = res.data?.school.delete as boolean
    return gqlSchool
}

export function buildDeleteSchoolInputArray(
    schools: School[]
): DeleteSchoolInput[] {
    return Array.from(schools, (c) => {
        return { id: c.school_id }
    })
}

export function buildCreateSchoolInputArray(
    schools: School[]
): DeleteSchoolInput[] {
    return Array.from(schools, (c) => {
        return { id: c.school_id }
    })
}

export async function listPrograms(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: LIST_PROGRAMS,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlPrograms = res.data?.school.programs as Program[]

    return gqlPrograms
}

export async function editPrograms(
    testClient: ApolloServerTestClient,
    id: string,
    program_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_PROGRAM,
            variables: { id: id, program_ids: program_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlPrograms = res.data?.school?.editPrograms as Program[]
    return gqlPrograms
}
