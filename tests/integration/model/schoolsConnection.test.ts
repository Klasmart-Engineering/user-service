import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import faker from 'faker'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { Model } from '../../../src/model'
import { createAdminUser } from '../../utils/testEntities'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import { School } from '../../../src/entities/school'
import { Organization } from '../../../src/entities/organization'
import { User } from '../../../src/entities/user'
import { schoolsConnection } from '../../utils/operations/modelOps'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createOrganization } from '../../factories/organization.factory'
import { Status } from '../../../src/entities/status'
import { createRole } from '../../factories/role.factory'
import { createUser } from '../../factories/user.factory'
import { createSchool } from '../../factories/school.factory'
import { userToPayload } from '../../utils/operations/userOps'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Role } from '../../../src/entities/role'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { generateShortCode } from '../../../src/utils/shortcode'
import { classesChildConnection } from '../../../src/schemas/school'
import { createClass } from '../../factories/class.factory'
import { Class } from '../../../src/entities/class'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('schoolsConnection', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    let admin: User
    let org1: Organization
    let org2: Organization
    let schools: School[] = []

    let wizardUser: User
    let wizardOrg: Organization
    let wizardingSchool: School
    let magicClass: Class
    let potionsClass: Class
    let ctx: Pick<Context, 'loaders'>

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        admin = await createAdminUser(testClient)
        org1 = createOrganization(admin)
        org2 = createOrganization(admin)
        await connection.manager.save([org1, org2])
        schools = []
        for (let i = 0; i < 10; i++) {
            const school = createSchool(org1, `school a${i}`)
            school.status = Status.ACTIVE
            schools.push(school)
        }

        for (let i = 0; i < 10; i++) {
            const school = createSchool(org2, `school b${i}`)
            school.status = Status.INACTIVE
            schools.push(school)
        }
        await connection.manager.save(schools)
    })

    context('data', () => {
        it('populates a SchoolConnectionNode at each edge.node based on the School entity', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 1 },
                true,
                { authorization: getAdminAuthToken() }
            )

            const node = result.edges[0].node
            expect(node).to.exist

            const school = schools.find((s) => s.school_id === node.id)
            expect(school).to.exist
            expect(node).to.deep.equal({
                id: school?.school_id,
                name: school?.school_name,
                shortCode: school?.shortcode,
                status: school?.status,
                organizationId: (await school?.organization)?.organization_id,
            })
        })
        it('makes 3 DB queries', async () => {
            connection.logger.reset()
            await schoolsConnection(testClient, 'FORWARD', { count: 5 }, true, {
                authorization: getAdminAuthToken(),
            })
            expect(connection.logger.count).to.equal(
                3,
                '1. COUNT, 2. DISTINCT ids, 3. SchoolConnectionNode data'
            )
        })
    })

    context('permissions', () => {
        let token: string

        /**
         * Test whether all `SchoolFilter` options can be successfully applied
         * Specific return edges are tested in the `filter` context
         */
        const testSchoolFilters = () =>
            ([
                {
                    organizationId: {
                        operator: 'eq',
                        value: faker.datatype.uuid(),
                    },
                },
                {
                    schoolId: {
                        operator: 'eq',
                        value: faker.datatype.uuid(),
                    },
                },
                {
                    name: {
                        operator: 'eq',
                        value: faker.random.word(),
                    },
                },
                {
                    shortCode: {
                        operator: 'eq',
                        value: generateShortCode(),
                    },
                },
                {
                    status: {
                        operator: 'eq',
                        value: Status.ACTIVE,
                    },
                },
            ] as IEntityFilter[]).forEach((filter) =>
                it(`can filter on ${Object.keys(filter)[0]}`, async () => {
                    return await expect(
                        schoolsConnection(
                            testClient,
                            'FORWARD',
                            { count: 1 },
                            true,
                            { authorization: token },
                            filter
                        )
                    ).to.be.fulfilled
                })
            )

        /**
         * Test whether all `SchoolSortBy` can be successfully applied
         * Ordering is checked separately in the `sorting` context
         */
        const testSchoolSortBy = () => {
            ;['id', 'name', 'shortCode'].forEach((field) =>
                it(`can sort on ${field}`, async () => {
                    return await expect(
                        schoolsConnection(
                            testClient,
                            'FORWARD',
                            { count: 1 },
                            true,
                            { authorization: token },
                            undefined,
                            { field, order: 'DESC' }
                        )
                    ).to.be.fulfilled
                })
            )
        }

        beforeEach(() => (token = getAdminAuthToken()))

        context('admin', () => {
            it('can view all Schools', async () => {
                const result = await schoolsConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    true,
                    { authorization: token }
                )
                expect(result.totalCount).to.eq(schools.length)
            })
        })

        context('non-admin', () => {
            let user: User

            const addPermission = async ({
                user,
                organization,
                permission,
            }: {
                user: User
                organization: Organization
                permission: PermissionName
            }) => {
                const role = await createRole(undefined, organization).save()

                await OrganizationMembership.createQueryBuilder()
                    .relation('roles')
                    .of({
                        user_id: user.user_id,
                        organization_id: organization.organization_id,
                    })
                    .add(role)

                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .add(permission)
            }

            beforeEach(async () => {
                user = await createUser().save()
                token = generateToken(userToPayload(user))
            })
            context('User with `view_my_school_20119', () => {
                beforeEach(async () => {
                    await createOrganizationMembership({
                        user,
                        organization: org1,
                    }).save()
                    await createSchoolMembership({
                        user,
                        school: schools[0],
                    }).save()
                    await addPermission({
                        user,
                        organization: org1,
                        permission: PermissionName.view_my_school_20119,
                    })
                })
                it('can view all Schools they belong to', async () => {
                    const result = await schoolsConnection(
                        testClient,
                        'FORWARD',
                        { count: 10 },
                        true,
                        { authorization: token }
                    )

                    expect(
                        result.edges.map((edge) => edge.node.id)
                    ).to.deep.eq([schools[0].school_id])
                })

                testSchoolFilters()

                testSchoolSortBy()
            })
            context('User with `view_school_20110', () => {
                beforeEach(async () => {
                    await createOrganizationMembership({
                        user,
                        organization: org1,
                    }).save()
                    await addPermission({
                        user,
                        organization: org1,
                        permission: PermissionName.view_school_20110,
                    })
                })
                it('can view all Schools in the Organizations they belong to', async () => {
                    const result = await schoolsConnection(
                        testClient,
                        'FORWARD',
                        undefined,
                        true,
                        { authorization: token }
                    )
                    expect(
                        result.edges.map((edge) => edge.node.id)
                    ).to.deep.equalInAnyOrder(
                        schools.slice(0, 10).map((s) => s.school_id)
                    )
                })

                testSchoolFilters()

                testSchoolSortBy()
            })
            context(
                'User with both `view_my_school_20119` and `view_school_20110`',
                () => {
                    context('in the same Organization', () => {
                        beforeEach(async () => {
                            const role = await createRole(undefined, org1, {
                                permissions: [
                                    PermissionName.view_school_20110,
                                    PermissionName.view_my_school_20119,
                                ],
                            }).save()
                            await createOrganizationMembership({
                                user,
                                organization: org1,
                                roles: [role],
                            }).save()

                            await createSchoolMembership({
                                user,
                                school: schools[0],
                            }).save()
                        })
                        it('can view all Schools in the Organizations they belong to', async () => {
                            const result = await schoolsConnection(
                                testClient,
                                'FORWARD',
                                undefined,
                                true,
                                {
                                    authorization: token,
                                }
                            )
                            expect(
                                result.edges.map((edge) => edge.node.id)
                            ).to.deep.equalInAnyOrder(
                                schools.slice(0, 10).map((s) => s.school_id)
                            )
                        })
                    })
                    context('in different Organizations', () => {
                        beforeEach(async () => {
                            await Promise.all(
                                [
                                    {
                                        organization: org1,
                                        permission:
                                            PermissionName.view_school_20110,
                                    },
                                    {
                                        organization: org2,
                                        permission:
                                            PermissionName.view_my_school_20119,
                                    },
                                ].map(async ({ organization, permission }) => {
                                    const role = await createRole(
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
                                school: schools[10],
                            }).save()
                        })
                        it('returns all the Schools in one Organization and the School that the User is associated with in the other Organization', async () => {
                            const result = await schoolsConnection(
                                testClient,
                                'FORWARD',
                                undefined,
                                true,
                                { authorization: token }
                            )
                            expect(
                                result.edges.map((edge) => edge.node.id)
                            ).to.deep.equalInAnyOrder(
                                schools.slice(0, 11).map((s) => s.school_id)
                            )
                        })

                        testSchoolFilters()

                        testSchoolSortBy()
                    })
                }
            )
            context('User with no `view_*_school` permission', () => {
                it('cannot see any Schools', async () => {
                    const result = await schoolsConnection(
                        testClient,
                        'FORWARD',
                        { count: 10 },
                        true,
                        { authorization: token }
                    )
                    expect(result.totalCount).to.eq(0)
                })
            })
        })
    })

    context('unfiltered', () => {
        it('returns all schools', async () => {
            const result = await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
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
                true,
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
                true,
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
                true,
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
                true,
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
                true,
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
                true,
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
                true,
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
                true,
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
                true,
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
        const fetchCount = 4
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
                        true,
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
                        true,
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

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await schoolsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                false,
                { authorization: getAdminAuthToken() }
            )

            expect(connection.logger.count).to.be.eq(
                2,
                '1. DISTINCT ids, 2. SchoolConnectionNode data'
            )
        })
    })

    context('child connections', () => {
        context('.classesConnection', async () => {
            beforeEach(async () => {
                wizardUser = await createUser().save()
                wizardOrg = await createOrganization().save()
                wizardingSchool = await createSchool(
                    wizardOrg,
                    'Hogwarts'
                ).save()
                magicClass = await createClass(
                    [wizardingSchool],
                    wizardOrg
                ).save()
                potionsClass = await createClass(
                    [wizardingSchool],
                    wizardOrg
                ).save()
                const role = await createRole(undefined, undefined, {
                    permissions: [
                        PermissionName.view_school_20110,
                        PermissionName.view_school_classes_20117,
                    ],
                }).save()

                await createOrganizationMembership({
                    user: wizardUser,
                    organization: wizardOrg,
                    roles: [role],
                }).save()
                await createSchoolMembership({
                    user: wizardUser,
                    school: wizardingSchool,
                }).save()

                const token = { id: wizardUser.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns classes for a school', async () => {
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 2,
                }

                const result = await classesChildConnection(
                    { id: wizardingSchool.school_id },
                    args,
                    ctx.loaders,
                    false
                )

                const expectedClassIds = [
                    magicClass.class_id,
                    potionsClass.class_id,
                ]
                const actualClassIds = result.edges.map((edge) => edge.node.id)

                expect(expectedClassIds).to.have.same.members(actualClassIds)
            })
        })
    })
})
