import { ReadStream } from 'fs'

import { AgeRange } from '../../../src/entities/ageRange'
import { Grade } from '../../../src/entities/grade'
import { User } from '../../../src/entities/user'
import { Organization } from '../../../src/entities/organization'
import { Subcategory } from '../../../src/entities/subcategory'
import { Subject } from '../../../src/entities/subject'
import { expect } from 'chai'
import { ApolloServerTestClient } from '../createTestClient'
import { getAdminAuthToken } from '../testConfig'
import { Headers } from 'node-mocks-http'
import { gqlTry } from '../gqlTry'
import { Program } from '../../../src/entities/program'
import { Stream } from 'stream'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { ISortField } from '../../../src/utils/pagination/sorting'
import { IPaginatedResponse } from '../../../src/utils/pagination/paginate'
import { UserConnectionNode } from '../../../src/types/graphQL/userConnectionNode'
import { SchoolSummaryNode } from '../../../src/types/graphQL/schoolSummaryNode'
import { ISchoolsConnectionNode } from '../../../src/types/graphQL/schoolsConnectionNode'
import { GradeConnectionNode } from '../../../src/types/graphQL/gradeConnectionNode'
import { ProgramConnectionNode } from '../../../src/types/graphQL/programConnectionNode'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRangeConnectionNode'
import { ClassConnectionNode } from '../../../src/types/graphQL/classConnectionNode'
import { SubjectConnectionNode } from '../../../src/types/graphQL/subjectConnectionNode'
import { OrganizationConnectionNode } from '../../../src/types/graphQL/organizationConnectionNode'
import { gql } from 'apollo-server-express'
import { Role } from '../../../src/entities/role'
import { CategorySummaryNode } from '../../../src/types/graphQL/categorySummaryNode'
import { DocumentNode } from 'graphql'

const NEW_USER = `
    mutation myMutation(
            $given_name: String
            $family_name: String
            $email: String
            $phone: String
            $avatar: String
            $date_of_birth: String
            $username: String
            $gender: String) {
        newUser(
            given_name: $given_name
            family_name: $family_name
            email: $email
            phone: $phone
            avatar: $avatar
            date_of_birth: $date_of_birth
            username: $username
            gender:$gender
        ) {
            user_id
            given_name
            family_name
            email
            phone
            avatar
            date_of_birth
            username
            gender
        }
    }
`

const SET_USER = `
    mutation myMutation(
            $user_id: ID!
            $given_name: String
            $family_name: String
            $email: String
            $avatar: String
            $date_of_birth: String
            $username: String
            $alternate_email: String
            $alternate_phone: String) {
        user(
            user_id: $user_id
            given_name: $given_name
            family_name: $family_name
            email: $email
            avatar: $avatar
            date_of_birth: $date_of_birth
            username: $username
            alternate_email: $alternate_email
            alternate_phone: $alternate_phone
        ) {
            user_id
            given_name
            family_name
            email
            avatar
            date_of_birth
            username
            alternate_email
            alternate_phone
        }
    }
`

const GET_USERS = `
    query myQuery {
        users {
            user_id
            given_name
            family_name
            email
            avatar
        }
    }
`

export const MY_USERS = `
    query myQuery {
        my_users {
            user_id
            email
            phone
            given_name
            family_name

        }
    }
`

const ME = `
    query myQuery {
        me {
            user_id
            email
        }
    }
`

const GET_USER = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            user_id
            given_name
            family_name
            email
            avatar
            date_of_birth
        }
    }
`

const GET_ALL_ORGANIZATIONS = `
    query getAllOrgs {
        organizations {
            organization_id
            organization_name
        }
    }
`

const GET_ORGANIZATIONS = `
    query getOrgs($organization_ids: [ID!]) {
        organizations(organization_ids: $organization_ids) {
            organization_id
            organization_name
        }
    }
`

const GET_AGE_RANGE = `
query getAgeRange($id: ID!){
  age_range(id: $id) {
    id
    name
    low_value
    low_value_unit
    high_value
    high_value_unit
    status
    system
  }
}
`

const GET_GRADE = `
query getAgeRange($id: ID!){
  grade(id: $id) {
    id
    name
    progress_from_grade {
      id
    }
    progress_to_grade {
      id
    }
    system
    status
  }
}
`

const GET_SUBCATEGORY = `
query getSubcategory($id: ID!){
  subcategory(id: $id) {
    id
    name
    system
    status
  }
}
`

const GET_PROGRAM = `
query getProgram($id: ID!){
  program(id: $id) {
    id
    name
    system
    status
  }
}
`

const GET_SUBJECT = `
query getSubject($id: ID!){
  subject(id: $id) {
    id
    name
    system
    status
  }
}
`

const USER_CSV_UPLOAD_MUTATION = `
    mutation UploadOrganizationsFromCSV($file: Upload!) {
        uploadOrganizationsFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

const CLASS_CSV_UPLOAD_MUTATION = `
    mutation classCSVFileUpload($file: Upload!) {
        uploadClassesFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

const SCHOOLS_CSV_UPLOAD_MUTATION = `
    mutation UploadSchoolsFromCSV($file: Upload!) {
        uploadSchoolsFromCSV(file: $file) {
            filename
            mimetype
            encoding
        }
    }
`

export const USERS_CONNECTION = `
    query usersConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: UserFilter, $sortArgs: UserSortInput) {
        usersConnection(direction:$direction, directionArgs:$directionArgs, filter:$filterArgs, sort: $sortArgs){
            totalCount
            edges {
                cursor
                node {
                    id
                    givenName
                    familyName
                    organizations {
                        id
                        status
                        userStatus
                    }
                    schools {
                        id
                    }
                    roles{
                        id
                    }
                }
            }
            pageInfo{
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
        }
    }
`

export const USERS_CONNECTION_MAIN_DATA = `
    query usersConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: UserFilter, $sortArgs: UserSortInput) {
        usersConnection(direction:$direction, directionArgs:$directionArgs, filter:$filterArgs, sort: $sortArgs){
            totalCount
            edges {
                cursor
                node {
                    id
                    givenName
                    familyName
                }
            }
            pageInfo{
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
        }
    }
`

const USER_NODE_FIELDS = gql`
    fragment userFields on UserConnectionNode {
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
        gender
    }
`

const USERS_CONNECTION_NODES = gql`
    ${USER_NODE_FIELDS}

    query($filter: UserFilter) {
        usersConnection(direction: FORWARD, filter: $filter) {
            edges {
                node {
                    ...userFields
                }
            }
        }
    }
`

const USER_NODE_QUERY = gql`
    ${USER_NODE_FIELDS}

    query($id: ID!) {
        userNode(id: $id) {
            ...userFields
        }
    }
`

const USER_NODE_QUERY_2_NODES = gql`
    query($id: ID!, $id2: ID!) {
        userNode(id: $id) {
            givenName
        }
        userNode2: userNode(id: $id2) {
            familyName
        }
    }
`

const PERMISSIONS_CONNECTION = `
    query permissionsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: PermissionFilter) {
        permissionsConnection(direction:$direction, directionArgs:$directionArgs, filter:$filterArgs){
            totalCount
            edges {
                cursor
                node {
                    permission_id
                }
            }
            pageInfo{
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
        }
    }
`

const SCHOOLS_CONNECTION = `
    query schoolsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: SchoolFilter, $sortArgs: SchoolSortInput) {
        schoolsConnection(direction:$direction, directionArgs:$directionArgs, filter:$filterArgs, sort: $sortArgs){
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    shortCode
                    status
                    organizationId
                }
            }
            pageInfo{
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
        }
    }
`

export const PROGRAMS_CONNECTION = `
    query programsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: ProgramFilter, $sortArgs: ProgramSortInput) {
        programsConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    status
                    system

                    ageRanges {
                        id
                        name
                        lowValue
                        lowValueUnit
                        highValue
                        highValueUnit
                        system
                        status
                    }

                    grades {
                        id
                        name
                        status
                        system
                    }

                    subjects {
                        id
                        name
                        status
                        system
                    }
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

export const PROGRAMS_CONNECTION_MAIN_DATA = `
    query programsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: ProgramFilter, $sortArgs: ProgramSortInput) {
        programsConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    status
                    system
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

const GRADES_CONNECTION = `
    query gradesConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: GradeFilter, $sortArgs: GradeSortInput) {
        gradesConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    status
                    system

                    fromGrade {
                        id
                        name
                        status
                        system
                    }

                    toGrade {
                        id
                        name
                        status
                        system
                    }
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

const GRADES_CONNECTION_MAIN_DATA = `
    query gradesConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: GradeFilter, $sortArgs: GradeSortInput) {
        gradesConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    status
                    system
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

export const CATEGORIES_CONNECTION = `
    query categoriesConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: CategoryFilter, $sortArgs: CategorySortInput) {
        categoriesConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    status
                    system
                }
            }
            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

export const AGE_RANGES_CONNECTION = `
    query AgeRangesConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: AgeRangeFilter, $sortArgs: AgeRangeSortInput) {
        ageRangesConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount

            edges {
                cursor
                node {
                    id
                    name
                    status
                    system
                    lowValue
                    lowValueUnit
                    highValue
                    highValueUnit
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

const CLASS_MAIN_FIELDS = gql`
    fragment classMainFields on ClassConnectionNode {
        id
        name
        status
        shortCode
    }
`

const CLASS_FIELDS = gql`
    ${CLASS_MAIN_FIELDS}

    fragment classFields on ClassConnectionNode {
        ...classMainFields

        schools {
            id
            name
            status
        }

        ageRanges {
            id
            name
            lowValue
            lowValueUnit
            highValue
            highValueUnit
            status
            system
        }

        grades {
            id
            name
            status
            system
        }

        subjects {
            id
            name
            status
            system
        }

        programs {
            id
            name
            status
            system
        }
    }
`

export const CLASSES_CONNECTION = gql`
    ${CLASS_FIELDS}

    query ClassesConnection(
        $direction: ConnectionDirection!
        $directionArgs: ConnectionsDirectionArgs
        $filterArgs: ClassFilter
        $sortArgs: ClassSortInput
    ) {
        classesConnection(
            direction: $direction
            directionArgs: $directionArgs
            filter: $filterArgs
            sort: $sortArgs
        ) {
            totalCount

            edges {
                cursor
                node {
                    ...classFields
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

export const CLASSES_CONNECTION_MAIN_DATA = gql`
    ${CLASS_MAIN_FIELDS}

    query ClassesConnection(
        $direction: ConnectionDirection!
        $directionArgs: ConnectionsDirectionArgs
        $filterArgs: ClassFilter
        $sortArgs: ClassSortInput
    ) {
        classesConnection(
            direction: $direction
            directionArgs: $directionArgs
            filter: $filterArgs
            sort: $sortArgs
        ) {
            totalCount

            edges {
                cursor
                node {
                    ...classMainFields
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

export const CLASS_NODE = gql`
    ${CLASS_FIELDS}

    query ClassNode($id: ID!) {
        classNode(id: $id) {
            ...classFields
        }
    }
`

export const CLASS_NODE_MAIN_DATA = gql`
    ${CLASS_MAIN_FIELDS}

    query ClassNode($id: ID!) {
        classNode(id: $id) {
            ...classMainFields
        }
    }
`

export const SUBJECTS_CONNECTION = `
    query SubjectsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: SubjectFilter, $sortArgs: SubjectSortInput) {
        subjectsConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount

            edges {
                cursor
                node {
                    id
                    name
                    status
                    system

                    categories {
                        id
                        name
                        status
                        system
                    }
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

export const SUBJECTS_CONNECTION_MAIN_DATA = `
    query SubjectsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: SubjectFilter, $sortArgs: SubjectSortInput) {
        subjectsConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs) {
            totalCount

            edges {
                cursor
                node {
                    id
                    name
                    status
                    system
                }
            }

            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`

export const ORGANIZATIONS_CONNECTION = `
    query organizationsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: OrganizationFilter, $sortArgs: OrganizationSortInput) {
        organizationsConnection(direction:$direction, directionArgs:$directionArgs, filter:$filterArgs, sort: $sortArgs){
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                    owners {
                        id
                    }
                }
            }
            pageInfo{
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
        }
    }
`

export const ORGANIZATIONS_CONNECTION_MAIN_DATA = `
    query organizationsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: OrganizationFilter, $sortArgs: OrganizationSortInput) {
        organizationsConnection(direction: $direction, directionArgs: $directionArgs, filter: $filterArgs, sort: $sortArgs){
            totalCount
            edges {
                cursor
                node {
                    id
                    name
                }
            }
            pageInfo{
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
        }
    }
`

const ORGANIZATIONS_CONNECTION_NODES = gql`
    query($filter: OrganizationFilter) {
        organizationsConnection(direction: FORWARD, filter: $filter) {
            edges {
                node {
                    id
                    name
                    contactInfo {
                        address1
                        address2
                        phone
                    }
                    shortCode
                    status
                }
            }
        }
    }
`

const REPLACE_ROLE = `
    mutation myMutation(
        $old_role_id: ID!
        $new_role_id: ID!
        $organization_id: ID!
    ) {
        replaceRole (old_role_id: $old_role_id, new_role_id: $new_role_id, organization_id: $organization_id){
            role_id
            role_name
            role_description
            system_role
            organization {
                organization_id
                organization_name
                address1
                address2
                phone
                shortCode
            }
            memberships {
                user_id
                organization_id
                join_timestamp
                shortcode
            }
            permissions {
                permission_name
                permission_id
                allow
            }
        }
    }
`

/**
 * Creates a new user, and makes extra assertions about what the new state should be (e.g. it got added to the db).
 */
export async function createUserAndValidate(
    testClient: ApolloServerTestClient,
    user: User
): Promise<User> {
    const gqlUser = await createUser(testClient, user, {
        authorization: getAdminAuthToken(),
    })
    const dbUser = await User.findOneOrFail({
        where: [{ email: user.email }, { phone: user.phone }],
    })
    expect(gqlUser).to.exist
    expect(gqlUser).to.include(user)
    expect(dbUser).to.include(user)

    return gqlUser
}

/**
 * Creates a new user, verifies the GraphQL operation completed without error, and returns the GraphQL response.
 */
export async function createUser(
    testClient: ApolloServerTestClient,
    user: User,
    headers: Headers
): Promise<User> {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: NEW_USER,
            variables: user as any,
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUser = res.data?.newUser as User
    return gqlUser
}

export async function updateUser(
    testClient: ApolloServerTestClient,
    modifiedUser: any,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: SET_USER,
            variables: modifiedUser,
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUser = res.data?.user as User
    return gqlUser
}

export async function replaceRole(
    testClient: ApolloServerTestClient,
    old_role_id: string,
    new_role_id: string,
    organization_id: string,
    headers?: Headers
) {
    const { mutate } = testClient
    const operation = () =>
        mutate({
            mutation: REPLACE_ROLE,
            variables: {
                old_role_id,
                new_role_id,
                organization_id,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)

    const gqlRole = res.data?.replaceRole as Role
    return gqlRole
}

export async function getUsers(
    testClient: ApolloServerTestClient,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_USERS,
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUsers = res.data?.users as User[]
    return gqlUsers
}

export async function myUsers(
    testClient: ApolloServerTestClient,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: MY_USERS,
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUsers = res.data?.my_users as User[]
    return gqlUsers
}

export async function getUser(
    testClient: ApolloServerTestClient,
    userId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_USER,
            variables: { user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlUser = res.data?.user as User
    return gqlUser
}

export async function me(
    testClient: ApolloServerTestClient,
    headers?: Headers,
    cookies?: any
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: ME,
            headers: headers,
            cookies: cookies,
        })

    const res = await gqlTry(operation)
    const gqlUser = res.data?.me as User
    return gqlUser
}

export async function getAllOrganizations(
    testClient: ApolloServerTestClient,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_ALL_ORGANIZATIONS,
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlOrgs = res.data?.organizations as Organization[]
    return gqlOrgs
}

export async function getOrganizations(
    testClient: ApolloServerTestClient,
    organizationIds: string[],
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_ORGANIZATIONS,
            variables: { organization_ids: organizationIds },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlOrgs = res.data?.organizations as Organization[]
    return gqlOrgs
}

export async function getAgeRange(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_AGE_RANGE,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlAgeRange = res.data?.age_range as AgeRange
    return gqlAgeRange
}

export async function getGrade(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_GRADE,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlGrade = res.data?.grade as Grade
    return gqlGrade
}

export async function getSubcategory(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_SUBCATEGORY,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubcategory = res.data?.subcategory as Subcategory
    return gqlSubcategory
}

export async function getSubject(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_SUBJECT,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubject = res.data?.subject as Subject
    return gqlSubject
}

export async function getProgram(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: GET_PROGRAM,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlProgram = res.data?.program as Program
    return gqlProgram
}

export function fileMockInput(
    file: Stream,
    filename: string,
    mimetype: string,
    encoding: string
) {
    return {
        resolve: () => {},
        reject: () => {},
        promise: new Promise((resolve) =>
            resolve({
                filename,
                mimetype,
                encoding,
                createReadStream: () => file,
            })
        ),
        file: {
            filename,
            mimetype,
            encoding,
            createReadStream: () => file,
        },
    }
}

export async function uploadClassesFile(
    testClient: ApolloServerTestClient,
    { file, filename, mimetype, encoding }: any,
    headers?: Headers
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: CLASS_CSV_UPLOAD_MUTATION,
            variables: variables,
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadClassesFromCSV
}

export async function uploadSchoolsFile(
    testClient: ApolloServerTestClient,
    { file, filename, mimetype, encoding }: any,
    headers?: Headers
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: SCHOOLS_CSV_UPLOAD_MUTATION,
            variables: variables,
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadSchoolsFromCSV
}

export async function uploadFile(
    testClient: ApolloServerTestClient,
    { file, filename, mimetype, encoding }: any,
    headers?: Headers
) {
    const variables = {
        file: fileMockInput(file, filename, mimetype, encoding),
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: USER_CSV_UPLOAD_MUTATION,
            variables: variables,
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.uploadOrganizationsFromCSV
}

export async function userConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<UserConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: USERS_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.usersConnection
}

export async function usersConnectionMainData(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<UserConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        USERS_CONNECTION_MAIN_DATA,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.usersConnection
}

export async function usersConnectionNodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    filter?: IEntityFilter
): Promise<IPaginatedResponse<UserConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: USERS_CONNECTION_NODES,
            variables: {
                direction: 'FORWARD',
                filter,
            },
            headers,
        })

    const res = await gqlTry(operation)
    return res.data?.usersConnection
}

export async function userNode(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string
): Promise<UserConnectionNode> {
    const { query } = testClient
    const operation = () =>
        query({
            query: USER_NODE_QUERY,
            variables: {
                id,
            },
            headers,
        })

    const res = await gqlTry(operation)
    return res.data?.userNode
}

export async function user2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: USER_NODE_QUERY_2_NODES,
            variables: {
                id,
                id2,
            },
            headers,
        })

    await gqlTry(operation)
}

export async function permissionsConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    includeTotalCount: boolean,
    directionArgs?: any,
    headers?: Headers,
    filter?: IEntityFilter
) {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        PERMISSIONS_CONNECTION,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: { direction, directionArgs, filter },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.permissionsConnection
}

export async function programsConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<ProgramConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: PROGRAMS_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.programsConnection
}

export async function programsConnectionMainData(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<ProgramConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        PROGRAMS_CONNECTION_MAIN_DATA,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.programsConnection
}

export async function schoolsConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<ISchoolsConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        SCHOOLS_CONNECTION,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.schoolsConnection
}

export async function gradesConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<GradeConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: GRADES_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.gradesConnection
}

export async function gradesConnectionMainData(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<GradeConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        GRADES_CONNECTION_MAIN_DATA,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.gradesConnection
}

export async function ageRangesConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<AgeRangeConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        AGE_RANGES_CONNECTION,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.ageRangesConnection
}

export async function classesConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<ClassConnectionNode>> {
    const { query } = testClient

    const operation = () =>
        query({
            query: CLASSES_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.classesConnection
}

export async function classesConnectionMainData(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<ClassConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        CLASSES_CONNECTION_MAIN_DATA,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.classesConnection
}

export async function classNode(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
): Promise<ClassConnectionNode> {
    const { query } = testClient
    const operation = () =>
        query({
            query: CLASS_NODE,
            variables: {
                id,
            },
            headers,
        })

    const res = await gqlTry(operation)
    return res.data?.classNode
}

export async function classNodeMainData(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: CLASS_NODE_MAIN_DATA,
            variables: {
                id,
            },
            headers,
        })

    const res = await gqlTry(operation)
    return res.data?.classNode
}

export async function subjectsConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<SubjectConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: SUBJECTS_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.subjectsConnection
}

export async function subjectsConnectionMainData(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<SubjectConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        SUBJECTS_CONNECTION_MAIN_DATA,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.subjectsConnection
}

export async function categoriesConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<CategorySummaryNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: CATEGORIES_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })
    const res = await gqlTry(operation)
    return res.data?.categoriesConnection
}

export async function organizationsConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<OrganizationConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: ORGANIZATIONS_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.organizationsConnection
}

export async function organizationsConnectionMainData(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<OrganizationConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        ORGANIZATIONS_CONNECTION_MAIN_DATA,
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.organizationsConnection
}

export async function organizationsConnectionNodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    filter?: IEntityFilter
): Promise<IPaginatedResponse<OrganizationConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: ORGANIZATIONS_CONNECTION_NODES,
            variables: {
                direction: 'FORWARD',
                filter,
            },
            headers,
        })

    const res = await gqlTry(operation)
    return res.data?.organizationsConnection
}

function buildPaginationQuery(
    paginationQuery: string | DocumentNode,
    includeTotalCount: boolean
) {
    return includeTotalCount
        ? paginationQuery
        : (paginationQuery as string).split('totalCount').join('')
}
