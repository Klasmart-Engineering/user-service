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
import { UserConnectionNode } from '../../../src/types/graphQL/user'
import { ISchoolsConnectionNode } from '../../../src/types/graphQL/school'
import { GradeConnectionNode } from '../../../src/types/graphQL/grade'
import { ProgramConnectionNode } from '../../../src/types/graphQL/program'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRange'
import { ClassConnectionNode } from '../../../src/types/graphQL/class'
import { SubjectConnectionNode } from '../../../src/types/graphQL/subject'
import { OrganizationConnectionNode } from '../../../src/types/graphQL/organization'
import { gql } from 'apollo-server-express'
import { Role } from '../../../src/entities/role'
import { print } from 'graphql'
import { PermissionConnectionNode } from '../../../src/types/graphQL/permission'
import { CategorySummaryNode } from '../../../src/types/graphQL/category'
import { RoleConnectionNode } from '../../../src/types/graphQL/role'
import { SubcategoryConnectionNode } from '../../../src/types/graphQL/subcategory'

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

const CLASS_NODE_QUERY_2_NODES = gql`
    query($id: ID!, $id2: ID!) {
        classNode(id: $id) {
            id
        }
        classNode2: classNode(id: $id2) {
            name
        }
    }
`

const PROGRAM_NODE_QUERY_2_NODES = gql`
    query($id: ID!, $id2: ID!) {
        programNode(id: $id) {
            name
        }
        programNode2: programNode(id: $id2) {
            name
        }
    }
`

const PROGRAM_NODE_QUERY = gql`
    query($id: ID!) {
        programNode(id: $id) {
            id
            name
            status
            system
        }
    }
`

export const PERMISSION_NODE_FIELDS = gql`
    fragment permissionFields on PermissionsConnectionNode {
        id
        name
        category
        group
        level
        description
        allow
    }
`

export const PERMISSIONS_CONNECTION = gql`
    ${PERMISSION_NODE_FIELDS}

    query(
        $direction: ConnectionDirection!
        $directionArgs: ConnectionsDirectionArgs
        $filterArgs: PermissionFilter
        $sortArgs: PermissionSortInput
    ) {
        permissionsConnection(
            direction: $direction
            directionArgs: $directionArgs
            filter: $filterArgs
            sort: $sortArgs
        ) {
            totalCount

            edges {
                cursor
                node {
                    ...permissionFields
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

export const PERMISSION_NODE = gql`
    ${PERMISSION_NODE_FIELDS}

    query PermissionNode($id: ID!) {
        permissionNode(id: $id) {
            ...permissionFields
        }
    }
`

export const SCHOOLS_CONNECTION = `
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

export const SCHOOLS_CONNECTION_WITH_CHILDREN = `
    query schoolsConnection($direction: ConnectionDirection!, $directionArgs: ConnectionsDirectionArgs, $filterArgs: SchoolFilter, $sortArgs: SchoolSortInput) {
        schoolsConnection(direction:$direction, directionArgs:$directionArgs, filter:$filterArgs, sort: $sortArgs){
            totalCount
            edges {
                node {
                    id
                    name
                    classesConnection {
                        totalCount
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
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
    }`

export const ROLE_FIELDS = gql`
    fragment roleFields on RoleConnectionNode {
        id
        name
        status
        system
        description
    }
`

export const ROLES_CONNECTION = gql`
    ${ROLE_FIELDS}

    query rolesConnection(
        $direction: ConnectionDirection!
        $directionArgs: ConnectionsDirectionArgs
        $filterArgs: RoleFilter
        $sortArgs: RoleSortInput
    ) {
        rolesConnection(
            direction: $direction
            directionArgs: $directionArgs
            filter: $filterArgs
            sort: $sortArgs
        ) {
            totalCount
            edges {
                cursor
                node {
                    ...roleFields
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

export const ROLE_NODE = gql`
    ${ROLE_FIELDS}

    query RoleNode($id: ID!) {
        roleNode(id: $id) {
            ...roleFields
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

        studentsConnection {
            totalCount
            edges {
                node {
                    id
                }
            }
        }
        teachersConnection {
            totalCount
            edges {
                node {
                    id
                }
            }
        }
        schoolsConnection {
            totalCount
            edges {
                node {
                    id
                }
            }
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

export const CLASSES_CONNECTION_SCHOOL_CHILD = gql`
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
            edges {
                node {
                    ...classFields
                }
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

export const GRADE_MAIN_FIELDS = gql`
    fragment gradeMainFields on GradeConnectionNode {
        id
        name
        status
        system
    }
`

const GRADE_FIELDS = gql`
    ${GRADE_MAIN_FIELDS}

    fragment gradeFields on GradeConnectionNode {
        ...gradeMainFields

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
`
export const CATEGORY_NODE = gql`
    query categoryNode($id: ID!) {
        categoryNode(id: $id) {
            id
            name
            status
            system
        }
    }
`

export const AGE_RANGE_NODE = gql`
    query ageRangeNode($id: ID!) {
        ageRangeNode(id: $id) {
            id
            name
            status
            system
        }
    }
`

export const GRADE_NODE = gql`
    ${GRADE_FIELDS}

    query GradeNode($id: ID!) {
        gradeNode(id: $id) {
            ...gradeFields
        }
    }
`

export const SUBCATEGORY_NODE = gql`
    query subcategoryNode($id: ID!) {
        subcategoryNode(id: $id) {
            id
            name
            status
            system
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
                    organizationMembershipsConnection {
                        totalCount
                        edges {
                            node {
                                organizationId
                                organization {
                                    id
                                }
                            }
                        }
                    }
                    schoolsConnection(direction: FORWARD) {
                        totalCount
                    }
                    classesConnection(direction: FORWARD) {
                        totalCount
                        edges {
                            node {
                                id
                            }
                        }
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

export const ORGANIZATION_NODE_CORE_FIELDS = gql`
    fragment organizationNodeCoreFields on OrganizationConnectionNode {
        id
        name
        status
        shortCode
        contactInfo {
            address1
            address2
            phone
        }
    }
`

const ORGANIZATION_NODE_FIELDS = gql`
    ${ORGANIZATION_NODE_CORE_FIELDS}

    fragment organizationNodeFields on OrganizationConnectionNode {
        ...organizationNodeCoreFields

        owners {
            id
        }

        branding {
            iconImageURL
            primaryColor
        }
    }
`

export const ORGANIZATION_NODE = gql`
    ${ORGANIZATION_NODE_FIELDS}

    query OrganizatioNode($id: ID!) {
        organizationNode(id: $id) {
            ...organizationNodeFields
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
export const SUBCATEGORIES_CONNECTION = gql`
    query(
        $direction: ConnectionDirection!
        $directionArgs: ConnectionsDirectionArgs
        $filterArgs: SubcategoryFilter
        $sortArgs: SubcategorySortInput
    ) {
        subcategoriesConnection(
            direction: $direction
            directionArgs: $directionArgs
            filter: $filterArgs
            sort: $sortArgs
        ) {
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

export async function runQuery(
    queryString: string,
    testClient: ApolloServerTestClient,
    headers?: Headers,
    variables?: Record<string, unknown>
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: queryString,
            headers,
            variables,
        })

    const res = await gqlTry(operation)
    return res.data
}

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

export async function class2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: CLASS_NODE_QUERY_2_NODES,
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
    filterArgs?: IEntityFilter,
    sortArgs?: ISortField
): Promise<IPaginatedResponse<PermissionConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        print(PERMISSIONS_CONNECTION),
        includeTotalCount
    )

    const operation = () =>
        query({
            query: paginationQuery,
            variables: { direction, directionArgs, filterArgs, sortArgs },
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

export async function programNode(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string
): Promise<ProgramConnectionNode> {
    const { query } = testClient
    const operation = () =>
        query({
            query: PROGRAM_NODE_QUERY,
            variables: {
                id,
            },
            headers,
        })
    const res = await gqlTry(operation)
    return res.data?.programNode
}

export async function program2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: PROGRAM_NODE_QUERY_2_NODES,
            variables: {
                id,
                id2,
            },
            headers,
        })

    await gqlTry(operation)
}

export const SCHOOL_NODE = gql`
    query SchoolNode($id: ID!) {
        schoolNode(id: $id) {
            id
            name
            status
            shortCode
            organizationId
            schoolMembershipsConnection {
                edges {
                    node {
                        schoolId
                        userId
                    }
                }
            }
        }
    }
`

export async function schoolsConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField,
    withChildren = false
): Promise<IPaginatedResponse<ISchoolsConnectionNode>> {
    const { query } = testClient

    let paginationQuery: string
    if (withChildren) {
        paginationQuery = buildPaginationQuery(
            SCHOOLS_CONNECTION_WITH_CHILDREN,
            includeTotalCount
        )
    } else {
        paginationQuery = buildPaginationQuery(
            SCHOOLS_CONNECTION,
            includeTotalCount
        )
    }

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

export async function rolesConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    headers?: Headers,
    filter?: IEntityFilter,
    sort?: ISortField
): Promise<IPaginatedResponse<RoleConnectionNode>> {
    const { query } = testClient
    const operation = () =>
        query({
            query: ROLES_CONNECTION,
            variables: {
                direction,
                directionArgs,
                filterArgs: filter,
                sortArgs: sort,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.rolesConnection
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
        print(CLASSES_CONNECTION_MAIN_DATA),
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

export async function subcategoriesConnection(
    testClient: ApolloServerTestClient,
    direction: string,
    directionArgs: any,
    includeTotalCount: boolean,
    headers?: Headers,
    filterArgs?: IEntityFilter,
    sortArgs?: ISortField
): Promise<IPaginatedResponse<SubcategoryConnectionNode>> {
    const { query } = testClient
    const paginationQuery = buildPaginationQuery(
        print(SUBCATEGORIES_CONNECTION),
        includeTotalCount
    )
    const operation = () =>
        query({
            query: paginationQuery,
            variables: {
                direction,
                directionArgs,
                filterArgs,
                sortArgs,
            },
            headers: headers,
        })

    const res = await gqlTry(operation)
    return res.data?.subcategoriesConnection
}

function buildPaginationQuery(
    paginationQuery: string,
    includeTotalCount: boolean
) {
    return includeTotalCount
        ? paginationQuery
        : paginationQuery.split('totalCount').join('')
}
