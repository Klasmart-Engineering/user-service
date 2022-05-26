/* eslint-disable no-console */
import faker from 'faker'
import { getConnection } from 'typeorm'
import { Class } from '../../../src/entities/class'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Role } from '../../../src/entities/role'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { createClass } from '../../factories/class.factory'
import { createOrganizationPlus } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSchools } from '../../factories/school.factory'
import { createSchoolMemberships } from '../../factories/schoolMembership.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { runQuery } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { reportAverageAndErrorBars } from '../utils'

describe('getOrganizationUsers pagination benchmark', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    faker.seed(123456)
    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })
    it('non admin users with permisison view_my_admin_users_40113', async () => {
        // HISTORY
        //
        // Running on 13in 2020 MacBook Pro, 32GB memory, 2 GHz Quad-Core Intel Core i5:
        //  Main branch {"version":"4.3.0"}: PERFORMANCE: 334ms +/- 10ms
        //  AD-2480: PERFORMANCE: 52ms +/- 9ms

        const numClassesPerSchool = 10
        const numTeachersPerClass = 2
        const numStudentsPerClass = 20
        const iterations = 10
        const numSchools = 10
        const numSchoolAdminsPerSchool = 2

        console.log('Starting setup...')
        console.time('setup')

        const org = await createOrganizationPlus({
            organization_name: 'org with many classes',
        }).save()

        const teacherRole = await Role.findOneOrFail({
            where: { role_name: 'Teacher', system_role: true },
        })
        const schoolAdminRole = await Role.findOneOrFail({
            where: { role_name: 'School Admin', system_role: true },
        })
        const studentRole = await Role.findOneOrFail({
            where: { role_name: 'Student', system_role: true },
        })

        const schools = createSchools(numSchools, org)
        await connection.manager.save(schools)

        const classes: Class[] = []
        const orgMemberPromises: Promise<OrganizationMembership>[] = []
        const students = createUsers(
            numStudentsPerClass * numClassesPerSchool * numSchools
        )
        await connection.manager.save(students, { chunk: 30 })
        for (const s of students) {
            orgMemberPromises.push(
                createOrganizationMembership({
                    user: s,
                    organization: org,
                    roles: [studentRole],
                }).save()
            )
        }
        const teachers = createUsers(
            numTeachersPerClass * numClassesPerSchool * numSchools
        )

        await connection.manager.save(teachers, { chunk: 30 })

        const testUser: User = teachers[0]
        const token = generateToken(userToPayload(testUser))

        for (const t of teachers) {
            orgMemberPromises.push(
                createOrganizationMembership({
                    user: t,
                    organization: org,
                    roles: [teacherRole],
                }).save()
            )
        }

        const schoolAdmins = createUsers(numSchoolAdminsPerSchool * numSchools)
        await connection.manager.save(schoolAdmins)

        for (const sa of schoolAdmins) {
            orgMemberPromises.push(
                createOrganizationMembership({
                    user: sa,
                    organization: org,
                    roles: [schoolAdminRole],
                }).save()
            )
        }

        await Promise.all(orgMemberPromises)

        const schoolMemberships: SchoolMembership[] = []

        for (const s of schools) {
            for (let c = 0; c < numClassesPerSchool; c++) {
                const classStudents: User[] = []
                const classTeachers: User[] = []
                for (let i = 0; i < numStudentsPerClass; i++) {
                    const s = students.pop()
                    if (s) classStudents.push(s)
                }
                for (let i = 0; i < numTeachersPerClass; i++) {
                    const t = teachers.pop()
                    if (t) classTeachers.push(t)
                }
                const m = createSchoolMemberships(
                    [...classStudents, ...classTeachers],
                    s
                )
                schoolMemberships.push(...m)
                classes.push(
                    createClass([s], org, {
                        teachers: classTeachers,
                        students: classStudents,
                    })
                )
            }
            const ourSchoolAdmins: User[] = []
            for (let i = 0; i < numSchoolAdminsPerSchool; i++) {
                const sa = schoolAdmins.pop()
                if (sa) ourSchoolAdmins.push(sa)
            }
            schoolMemberships.push(
                ...createSchoolMemberships(ourSchoolAdmins, s)
            )
        }
        await connection.manager.save(classes, { chunk: 30 })
        await connection.manager.save(schoolMemberships, { chunk: 30 })

        console.log('Setup complete...')
        console.timeEnd('setup')
        /* This a simplified query to illustrate the performance improvement */
        const query = `
        query getOrganizationUsers(
            $direction: ConnectionDirection!
                $count: PageSize
                $cursor: String
                $order: SortOrder!
                $orderBy: UserSortBy!
                $filter: UserFilter,
            ) {
                usersConnection(
                    direction: $direction
                    directionArgs: { count: $count, cursor: $cursor }
                    sort: { field: [$orderBy], order: $order }
                    filter: $filter
                ) {
                    totalCount
                    pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
                edges {
                    node {
                        id
                        givenName
                        familyName
                        avatar
                        status
                        contactInfo {
                            email
                            phone
                            username
                        }
                        dateOfBirth
                        gender
        	        }
      	        }
            }
        }
        `

        console.log('Running query...')
        /* These are reduced variables  */
        const variables = {
            direction: 'FORWARD',
            count: 10,
            order: 'ASC',
            orderBy: 'givenName',
            filter: {
                organizationId: {
                    operator: 'eq',
                    value: org.organization_id,
                },
                AND: [
                    {
                        OR: [
                            {
                                givenName: {
                                    operator: 'contains',
                                    value: '',
                                    caseInsensitive: true,
                                },
                            },
                            {
                                familyName: {
                                    operator: 'contains',
                                    value: '',
                                    caseInsensitive: true,
                                },
                            },
                            {
                                email: {
                                    operator: 'contains',
                                    caseInsensitive: true,
                                    value: '',
                                },
                            },
                            {
                                phone: {
                                    operator: 'contains',
                                    caseInsensitive: true,
                                    value: '',
                                },
                            },
                        ],
                    },
                    {
                        OR: [
                            {
                                organizationUserStatus: {
                                    operator: 'eq',
                                    value: 'active',
                                },
                            },
                            {
                                organizationUserStatus: {
                                    operator: 'eq',
                                    value: 'inactive',
                                },
                            },
                        ],
                    },
                ],
            },
        }

        await reportAverageAndErrorBars(iterations, async () =>
            runQuery(
                query,
                testClient,
                {
                    authorization: token,
                },
                variables
            )
        )
    })
})
