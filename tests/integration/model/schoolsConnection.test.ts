import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import faker from 'faker'
import { createTestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { Model } from '../../../src/model'
import { createAdminUser } from '../../utils/testEntities'
import {
    generateToken,
    getAdminAuthToken,
    getNonAdminAuthToken,
} from '../../utils/testConfig'
import { School } from '../../../src/entities/school'
import { Organization } from '../../../src/entities/organization'
import { User } from '../../../src/entities/user'
import { schoolsConnection } from '../../utils/operations/modelOps'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createOrganization } from '../../factories/organization.factory'
import { generateShortCode } from '../../../src/utils/shortcode'
import { Status } from '../../../src/entities/status'
import { createRole as roleFactory } from '../../factories/role.factory'
import { createUser as userFactory } from '../../factories/user.factory'
import { createSchool } from '../../factories/school.factory'
import { createRole, inviteUser } from '../../utils/operations/organizationOps'
import { userToPayload } from '../../utils/operations/userOps'
import { grantPermission } from '../../utils/operations/roleOps'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'

use(chaiAsPromised)

async function createUserInRole(
    testClient: ApolloServerTestClient,
    orgId: string,
    roleId: string,
    schoolIds: string[],
    orgOwnerToken: string
): Promise<User> {
    const gender = ['Male', 'Female']
    let gqlresult = await inviteUser(
        testClient,
        orgId,
        faker.internet.email(),
        undefined,
        faker.name.firstName(),
        faker.name.lastName(),
        '02-1974',
        faker.name.firstName(),
        faker.random.arrayElement(gender),
        undefined,
        new Array(roleId),
        schoolIds,
        [],
        { authorization: orgOwnerToken }
    )
    return gqlresult.user
}

describe('schoolsConnection', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    let admin: User
    let org1: Organization
    let org2: Organization
    let schools: School[] = []

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        admin = await createAdminUser(testClient)
        org1 = await createOrganization(admin)
        org2 = await createOrganization(admin)
        await connection.manager.save([org1, org2])
        schools = []
        for (let i = 0; i < 10; i++) {
            let school = await createSchool(org1, `school a${i}`)
            school.shortcode = generateShortCode()
            school.status = Status.ACTIVE
            schools.push(school)
        }

        for (let i = 0; i < 10; i++) {
            let school = await createSchool(org2, `school b${i}`)
            school.shortcode = generateShortCode()
            school.status = Status.INACTIVE
            schools.push(school)
        }
        await connection.manager.save(schools)
    })

    context('as a user with PermissionName.view_my_school_20119', () => {
        let userToken: string

        beforeEach(async () => {
            const role = await createRole(testClient, org1.organization_id)
            await grantPermission(
                testClient,
                role.role_id,
                PermissionName.view_my_school_20119,
                { authorization: getAdminAuthToken() }
            )
            userToken = generateToken(
                userToPayload(
                    await createUserInRole(
                        testClient,
                        org1.organization_id,
                        role.role_id,
                        [schools[0].school_id],
                        getAdminAuthToken()
                    )
                )
            )
        })
        it('returns the school that the user is associated with', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: userToken }
            )

            expect(result.totalCount).to.eq(1)
        })
    })

    context('as a user with PermissionName.view_school_20110', () => {
        let userToken: string
        beforeEach(async () => {
            const role = await createRole(testClient, org1.organization_id)
            await grantPermission(
                testClient,
                role.role_id,
                PermissionName.view_school_20110,
                { authorization: getAdminAuthToken() }
            )
            userToken = generateToken(
                userToPayload(
                    await createUserInRole(
                        testClient,
                        org1.organization_id,
                        role.role_id,
                        [],
                        getAdminAuthToken()
                    )
                )
            )
        })
        it('returns all the schools within the organization', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: userToken }
            )
            expect(result.totalCount).to.eq(10)
        })
    })

    context(
        'as having PermissionName.view_school_20110 of one Org and PermissionName.view_my_school_20119 of the other',
        () => {
            let userToken: string

            beforeEach(async () => {
                const user = await userFactory().save()
                userToken = generateToken(userToPayload(user))
                await Promise.all(
                    [
                        {
                            organization: org1,
                            permission: PermissionName.view_school_20110,
                        },
                        {
                            organization: org2,
                            permission: PermissionName.view_my_school_20119,
                        },
                    ].map(async ({ organization, permission }) => {
                        const role = await roleFactory(
                            undefined,
                            organization,
                            {
                                permissions: [permission],
                            }
                        ).save()
                        await createOrganizationMembership({
                            user,
                            organization,
                            roles: [role],
                        }).save()
                    })
                )

                await createSchoolMembership({
                    user,
                    school: schools[11],
                }).save()
            })
            it('returns all the schools in one organization and the school that the user is associated with in the other organization', async () => {
                const result = await schoolsConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: userToken }
                )
                expect(result.totalCount).to.eq(11)
            })
        }
    )
    context('as a non org member', () => {
        it('returns zero schools', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getNonAdminAuthToken() }
            )
            expect(result.totalCount).to.eq(0)
        })
    })

    context('unfiltered', () => {
        it('returns all schools', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(20)
        })
    })

    context('filtered', () => {
        it('supports filtering by organizationId', async () => {
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: org1.organization_id,
                },
            }
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(10)
        })
        it('supports filtering by school ID', async () => {
            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'eq',
                    value: schools[0].school_id,
                },
            }
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)
        })
        it('supports filtering by school name', async () => {
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: '1',
                },
            }
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(2)
        })
        it('supports filtering by school shortCode', async () => {
            const filter: IEntityFilter = {
                shortCode: {
                    operator: 'eq',
                    value: schools[0].shortcode!,
                },
            }
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)
        })
        it('supports filtering by school status', async () => {
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: 'inactive',
                },
            }
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(10)
        })
        // "status" appears in both, make sure we won't produce an ambiguous column reference
        it('supports filtering by school status and organization', async () => {
            const filter: IEntityFilter = {
                AND: [
                    {
                        status: {
                            operator: 'eq',
                            value: 'inactive',
                        },
                    },
                    {
                        organizationId: {
                            operator: 'eq',
                            value: org2.organization_id,
                        },
                    },
                ],
            }
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(10)
        })
    })

    context('sorting', () => {
        it('supports sorting by school ID', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                {
                    field: 'id',
                    order: 'DESC',
                }
            )

            const schoolsOrderedByIdDesc = [...schools].sort((a, b) => {
                return b.school_id.localeCompare(a.school_id)
            })
            for (let i = 0; i < result.edges.length; i++) {
                expect(result.edges[i].node.id).to.eq(
                    schoolsOrderedByIdDesc[i].school_id
                )
            }
        })
        it('supports sorting by school name', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                {
                    field: 'name',
                    order: 'DESC',
                }
            )

            const schoolsOrderedByNameDesc = [...schools].sort((a, b) => {
                return b.school_name.localeCompare(a.school_name)
            })

            for (let i = 0; i < result.edges.length; i++) {
                expect(result.edges[i].node.name).to.eq(
                    schoolsOrderedByNameDesc[i].school_name
                )
            }
        })
        it('supports sorting by school shortcode', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                {
                    field: 'shortCode',
                    order: 'DESC',
                }
            )
            const schoolsOrderedByShortCodeDesc = [...schools].sort((a, b) => {
                return b.shortcode!.localeCompare(a.shortcode!)
            })
            for (let i = 0; i < result.edges.length; i++) {
                expect(result.edges[i].node.shortCode).to.eq(
                    schoolsOrderedByShortCodeDesc[i].shortcode
                )
            }
        })
    })

    context('combinations', () => {
        let fetchCount = 4
        context('forwards pagination', () => {
            it('paginates correctly with filtering & sorting applied', async () => {
                const schoolsOrderedByNameAsc = [...schools]
                    .sort((a, b) => {
                        return a.school_name.localeCompare(b.school_name)
                    })
                    .filter((s) => s.school_name.includes('a'))

                let hasNextPage = true
                let cursor: string | undefined = undefined
                let index = 0

                while (hasNextPage) {
                    const result: any = await schoolsConnection(
                        testClient,
                        'FORWARD',
                        { count: fetchCount, cursor },
                        { authorization: getAdminAuthToken() },
                        {
                            name: {
                                operator: 'contains',
                                value: 'a',
                            },
                        },
                        {
                            field: 'name',
                            order: 'ASC',
                        }
                    )
                    const unseenUsers = 10 - index
                    expect(result.totalCount).to.eq(10)
                    expect(result.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    for (let i = 0; i < result.edges.length; i++) {
                        expect(result.edges[i].node.name).to.eq(
                            schoolsOrderedByNameAsc[index].school_name
                        )
                        index++
                    }
                    hasNextPage = result.pageInfo.hasNextPage
                    cursor = result.pageInfo.endCursor
                }
            })
        })

        context('backwards pagination', async () => {
            it('paginates correctly with filtering & sorting applied', async () => {
                const schoolsOrderedByNameDesc = [...schools]
                    .sort((a, b) => {
                        return b.school_name.localeCompare(a.school_name)
                    })
                    .filter((s) => s.school_name.includes('a'))

                let hasPreviousPage = true
                let cursor: string | undefined = undefined
                let index = 0

                while (hasPreviousPage) {
                    const result: any = await schoolsConnection(
                        testClient,
                        'BACKWARD',
                        { count: fetchCount, cursor },
                        { authorization: getAdminAuthToken() },
                        {
                            name: {
                                operator: 'contains',
                                value: 'a',
                            },
                        },
                        {
                            field: 'name',
                            order: 'ASC',
                        }
                    )
                    const unseenUsers = 10 - index
                    expect(result.totalCount).to.eq(10)
                    expect(result.edges.length).to.eq(
                        unseenUsers < fetchCount
                            ? unseenUsers
                            : unseenUsers % fetchCount
                            ? unseenUsers % fetchCount
                            : fetchCount
                    )

                    result.edges.reverse()

                    for (let i = 0; i < result.edges.length; i++) {
                        expect(result.edges[i].node.name).to.eq(
                            schoolsOrderedByNameDesc[index].school_name
                        )
                        index++
                    }
                    hasPreviousPage = result.pageInfo.hasPreviousPage
                    cursor = result.pageInfo.startCursor
                }
            })
        })
    })
})
