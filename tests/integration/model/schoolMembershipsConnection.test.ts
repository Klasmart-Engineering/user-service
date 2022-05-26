import { expect } from 'chai'
import { SelectQueryBuilder, getConnection } from 'typeorm'
import { createEntityScope } from '../../../src/directives/isAdmin'
import { Organization } from '../../../src/entities/organization'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { schoolMembershipConnectionQuery } from '../../../src/pagination/schoolMembershipsConnection'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { schoolMembershipsConnectionResolver as resolverForSchool } from '../../../src/schemas/school'
import { schoolMembershipsConnectionResolver as resolverForUser } from '../../../src/schemas/user'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'

describe('schoolMembershipsConnection', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    let admin: User
    let nonAdmin: User
    let adminScope: SelectQueryBuilder<SchoolMembership>
    let nonAdminScope: SelectQueryBuilder<SchoolMembership>

    let school1: School
    let school2: School
    let school3: School
    let school1Memberships: SchoolMembership[]
    let school2Memberships: SchoolMembership[]
    let school3Memberships: SchoolMembership[]
    let school1Role: Role
    let school2Role: Role
    let organization: Organization
    let organization2: Organization

    function ids(memberships: SchoolMembership[]) {
        return memberships.map((m) => m.user_id + m.school_id)
    }

    beforeEach(async () => {
        admin = await createAdminUser(testClient)
        nonAdmin = await createNonAdminUser(testClient)
        adminScope = (await createEntityScope({
            permissions: new UserPermissions({
                id: admin.user_id,

                email: admin.email!,
            }),
            entity: 'schoolMembership',
        })) as SelectQueryBuilder<SchoolMembership>
        nonAdminScope = (await createEntityScope({
            permissions: new UserPermissions({
                id: nonAdmin.user_id,
                email: nonAdmin.email!,
            }),
            entity: 'schoolMembership',
        })) as SelectQueryBuilder<SchoolMembership>

        organization = await createOrganization().save()
        organization2 = await createOrganization().save()

        school1 = await createSchool(organization).save()
        school2 = await createSchool(organization).save()
        school3 = await createSchool(organization2).save()
        school1Role = await createRole('r1', organization).save()
        school2Role = await createRole('r2', organization).save()

        school1Memberships = await Promise.all([
            createSchoolMembership({
                school: school1,
                user: await createUser().save(),
                roles: [school1Role],
                status: Status.ACTIVE,
            }).save(),
            createSchoolMembership({
                school: school1,
                user: await createUser().save(),
                roles: [school1Role],
                status: Status.ACTIVE,
            }).save(),
        ])

        school2Memberships = await Promise.all([
            createSchoolMembership({
                school: school2,
                user: await createUser().save(),
                roles: [school2Role],
                status: Status.INACTIVE,
            }).save(),
            createSchoolMembership({
                school: school2,
                user: await createUser().save(),
                roles: [school2Role],
                status: Status.INACTIVE,
            }).save(),
        ])
        school3Memberships = [
            await createSchoolMembership({
                school: school3,
                user: await createUser().save(),
                status: Status.INACTIVE,
            }).save(),
        ]
    })

    describe('schoolMembershipConnectionQuery()', () => {
        context('filtering', () => {
            async function runQuery(filter: IEntityFilter) {
                const newScope = await schoolMembershipConnectionQuery(
                    adminScope,
                    filter
                )
                return newScope.getMany()
            }
            it('filters by userId', async () => {
                const members = await runQuery({
                    userId: {
                        operator: 'eq',
                        value: school1Memberships[0].user_id,
                    },
                })
                expect(members).to.have.lengthOf(1)
            })
            it('filters by schoolId', async () => {
                const members = await runQuery({
                    schoolId: {
                        operator: 'eq',
                        value: school1.school_id,
                    },
                })
                expect(members).to.have.lengthOf(school1Memberships.length)
            })
            it('filters by roleId', async () => {
                const members = await runQuery({
                    roleId: {
                        operator: 'eq',
                        value: school1Role.role_id,
                    },
                })
                expect(members).to.have.lengthOf(school1Memberships.length)
            })
            it('filters by status', async () => {
                const members = await runQuery({
                    status: {
                        operator: 'eq',
                        value: 'active',
                    },
                })
                expect(members).to.have.lengthOf(school1Memberships.length)
            })
            it('filters by organizationId', async () => {
                const members = await runQuery({
                    organizationId: {
                        operator: 'eq',
                        value: organization2.organization_id,
                    },
                })
                expect(members).to.have.lengthOf(school3Memberships.length)
            })
        })
    })

    describe('schoolMembershipsConnectionChild', () => {
        let clientUser: User
        let ctx: Pick<Context, 'loaders'>
        let fakeInfo: any

        beforeEach(async () => {
            clientUser = await createUser().save()

            const nonAdminRole = await createRole(
                'nonAdminRole',
                organization,
                {
                    permissions: [
                        PermissionName.view_my_school_users_40111,
                        PermissionName.view_my_school_20119,
                    ],
                }
            ).save()
            await createOrganizationMembership({
                user: clientUser,
                organization,
                roles: [nonAdminRole],
            }).save()

            // add the client user to both schools
            school1Memberships.push(
                await createSchoolMembership({
                    school: school1,
                    user: clientUser,
                    roles: [school1Role],
                }).save()
            )
            school2Memberships.push(
                await createSchoolMembership({
                    school: school2,
                    user: clientUser,
                    roles: [school2Role],
                }).save()
            )

            const token = { id: clientUser.user_id }
            const permissions = new UserPermissions(token)
            ctx = {
                loaders: createContextLazyLoaders(permissions),
            }
            fakeInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'schoolMembershipsConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })
        context('as child of a user', () => {
            it('returns memberships per user', async () => {
                const memberships = await resolverForUser(
                    { id: clientUser.user_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(memberships.edges).to.have.lengthOf(2)
                const schoolsIds = memberships.edges.map((e) => e.node.schoolId)
                expect(schoolsIds).to.have.members([
                    school1.school_id,
                    school2.school_id,
                ])
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const memberships = await resolverForUser(
                    { id: clientUser.user_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(memberships.totalCount).to.equal(2)
            })
            it('omits totalCount when not requested', async () => {
                const memberships = await resolverForUser(
                    { id: clientUser.user_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(memberships.totalCount).be.undefined
            })
        })
        context('as child of a school', () => {
            it('returns memberships per school', async () => {
                const memberships = await resolverForSchool(
                    { id: school1.school_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(memberships.edges).to.have.lengthOf(
                    school1Memberships.length
                )
                const returnUsersIds = memberships.edges.map(
                    (e) => e.node.userId
                )
                const actualUserIds = school1Memberships.map((m) => m.user_id)
                expect(returnUsersIds).to.have.members(actualUserIds)
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const memberships = await resolverForSchool(
                    { id: school1.school_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(memberships.totalCount).to.equal(
                    school1Memberships.length
                )
            })
            it('omits totalCount when not requested', async () => {
                const memberships = await resolverForSchool(
                    { id: school1.school_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(memberships.totalCount).be.undefined
            })
        })

        it('uses exactly one dataloader when called with multiple parents', async () => {
            const otherUser = await createUser().save()
            school1Memberships.push(
                await createSchoolMembership({
                    school: school1,
                    user: otherUser,
                    roles: [school1Role],
                }).save()
            )

            connection.logger.reset()
            const loaderResults = []
            for (const user of [clientUser, otherUser]) {
                loaderResults.push(
                    resolverForUser({ id: user.user_id }, {}, ctx, fakeInfo)
                )
            }
            await Promise.all(loaderResults)
            expect(connection.logger.count).to.be.eq(
                4,
                '2 for permissions, 1 for org memberships, 1 for schools memberships'
            )
        })

        context('sorting', () => {
            it('sorts by userId', async () => {
                const memberships = await resolverForSchool(
                    { id: school1.school_id },
                    {
                        sort: {
                            field: 'userId',
                            order: 'ASC',
                        },
                    },
                    ctx,
                    fakeInfo
                )
                const sorted = school1Memberships.map((m) => m.user_id).sort()
                expect(
                    memberships.edges.map((e) => e.node.userId)
                ).to.deep.equal(sorted)
            })
            it('sorts by schoolId', async () => {
                const memberships = await resolverForUser(
                    { id: clientUser.user_id },
                    {
                        sort: {
                            field: 'schoolId',
                            order: 'ASC',
                        },
                    },
                    ctx,
                    fakeInfo
                )
                const sorted = [school1, school2].map((m) => m.school_id).sort()
                expect(
                    memberships.edges.map((e) => e.node.schoolId)
                ).to.deep.equal(sorted)
            })
        })
    })
})
