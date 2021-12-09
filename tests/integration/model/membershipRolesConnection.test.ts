import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Role } from '../../../src/entities/role'
import { Organization } from '../../../src/entities/organization'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { createRole } from '../../factories/role.factory'
import { createOrganization } from '../../factories/organization.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import { createUser } from '../../factories/user.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import { RoleConnectionNode } from '../../../src/types/graphQL/role'
import {
    rolesConnectionChild as orgMembershipRolesConnectionChild,
    rolesConnectionChildResolver as orgMembershipRolesConnectionChildResolver,
} from '../../../src/schemas/organizationMembership'
import {
    rolesConnectionChild as schoolMembershipRolesConnectionChild,
    rolesConnectionChildResolver as schoolMembershipRolesConnectionChildResolver,
} from '../../../src/schemas/schoolMembership'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { School } from '../../../src/entities/school'
import { createSchool } from '../../factories/school.factory'

use(chaiAsPromised)

describe('membershipRolesConnection', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org1Roles: Role[]
    let org2Roles: Role[]
    let membershipRoles: Role[]
    let info: GraphQLResolveInfo
    const ownedRolesCount = 10
    let user: User

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        info = ({
            fieldNodes: [
                {
                    selectionSet: {
                        selections: [
                            {
                                kind: 'Field',
                                name: {
                                    value: 'totalCount',
                                },
                            },
                        ],
                    },
                },
            ],
        } as unknown) as GraphQLResolveInfo
        admin = await createAdminUser(testClient)
        org1 = createOrganization(admin)
        org2 = createOrganization(admin)
        await connection.manager.save([org1, org2])
        org1Roles = []
        org2Roles = []
        const roles = []

        for (let i = 0; i < ownedRolesCount; i++) {
            const role = createRole(`role ${i}`, org1)
            role.status = Status.INACTIVE
            org1Roles.push(role)
        }

        for (let i = 0; i < ownedRolesCount; i++) {
            const role = createRole(`role ${i}`, org2)
            role.status = Status.INACTIVE
            org2Roles.push(role)
        }

        user = await createUser().save()

        roles.push(...org1Roles, ...org2Roles)

        await connection.manager.save(roles)
    })

    context('as child connection', async () => {
        let fakeResolverInfo: any

        beforeEach(() => {
            fakeResolverInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'rolesConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })

        // these tests use organizations as the parent
        // but test code paths that are common across all child connection implementation
        // regardless of the parent entity type
        context('common across all parents', () => {
            let ctx: { loaders: IDataLoaders }

            beforeEach(async () => {
                user = await createUser().save()
                membershipRoles = [org1Roles[0], org1Roles[1]]

                await createOrganizationMembership({
                    user,
                    organization: org1,
                    roles: membershipRoles,
                }).save()

                const token = { id: user.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            const resolveForRoles = async (organizations: Organization[]) => {
                const loaderResults = []
                for (const organization of organizations) {
                    const loaderResult = orgMembershipRolesConnectionChild(
                        organization.organization_id,
                        user.user_id,
                        {},
                        ctx.loaders,
                        false
                    )
                    loaderResults.push(loaderResult)
                }

                await Promise.all(loaderResults)
            }

            it("db calls doen't increase with number of resolver calls", async () => {
                // warm up permission caches
                await resolveForRoles([org1, org2])
                connection.logger.reset()

                await resolveForRoles([org1])
                const dbCallsForSingleRole = connection.logger.count
                connection.logger.reset()

                await resolveForRoles([org1, org2])
                const dbCallsForTwoRoles = connection.logger.count
                expect(dbCallsForTwoRoles).to.be.eq(dbCallsForSingleRole)
            })

            context('sorting', () => {
                let args: IChildPaginationArgs

                beforeEach(() => {
                    args = {
                        direction: 'FORWARD',
                        count: 5,
                        sort: {
                            field: 'given_name',
                            order: 'ASC',
                        },
                    }
                })

                const checkSorted = async (
                    entityProperty: keyof Role,
                    fieldName: keyof RoleConnectionNode
                ) => {
                    const result = await orgMembershipRolesConnectionChild(
                        org1.organization_id,
                        user.user_id,
                        args,
                        ctx.loaders,
                        false
                    )

                    const sorted = membershipRoles
                        .map((r) => r[entityProperty])
                        .sort((a, b) => {
                            // pagination sorting sorts in a case insensitive way
                            return (a as string)
                                .toLowerCase()
                                .localeCompare((b as string).toLowerCase())
                        })

                    expect(
                        result.edges.map((e) => e.node[fieldName])
                    ).deep.equal(sorted)
                }

                it('sorts by id', async () => {
                    args.sort!.field = 'role_id'

                    return checkSorted('role_id', 'id')
                })
                it('sorts by name', async () => {
                    args.sort!.field = 'role_name'

                    return checkSorted('role_name', 'name')
                })
            })
        })

        context('organization membership parent', () => {
            let ctx: { loaders: IDataLoaders }
            let user: User
            let user2: User
            let role1: Role
            let role2: Role

            beforeEach(async () => {
                user = await createUser().save()
                user2 = await createUser().save()

                role1 = await createRole(undefined, org1).save()
                role2 = await createRole(undefined, org1).save()

                await createOrganizationMembership({
                    user: user,
                    organization: org1,
                    roles: [role1],
                }).save()

                await createOrganizationMembership({
                    user: user2,
                    organization: org1,
                    roles: [role2],
                }).save()

                const token = { id: user.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns correct roles per organization-user', async () => {
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 2,
                }

                const result = await orgMembershipRolesConnectionChild(
                    org1.organization_id,
                    user.user_id,
                    args,
                    ctx.loaders,
                    false
                )

                expect(
                    result.edges.map((e) => e.node.id)
                ).to.have.same.members([role1.role_id])
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) => {
                    return orgMembershipRolesConnectionChildResolver(
                        {
                            organizationId: org1.organization_id,
                            userId: user.user_id,
                        },
                        {},
                        ctx,
                        fakeInfo
                    )
                }

                it('returns total count', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(1)
                })

                it('doesnt return total count', async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })

        context('school membership parent', () => {
            let ctx: { loaders: IDataLoaders }
            let user2: User
            let role1: Role
            let role2: Role
            let school: School

            beforeEach(async () => {
                user = await createUser().save()
                user2 = await createUser().save()

                role1 = await createRole(undefined, org1).save()
                role2 = await createRole(undefined, org1).save()

                school = await createSchool().save()

                await createOrganizationMembership({
                    user,
                    organization: org1,
                }).save()

                await createSchoolMembership({
                    user: user,
                    school,
                    roles: [role1],
                }).save()

                await createSchoolMembership({
                    user: user2,
                    school,
                    roles: [role2],
                }).save()

                const token = { id: user.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns correct roles per school-user', async () => {
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 2,
                }

                const result = await schoolMembershipRolesConnectionChild(
                    school.school_id,
                    user.user_id,
                    args,
                    ctx.loaders,
                    false
                )

                expect(
                    result.edges.map((e) => e.node.id)
                ).to.have.same.members([role1.role_id])
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) => {
                    return schoolMembershipRolesConnectionChildResolver(
                        {
                            schoolId: school.school_id,
                            userId: user.user_id,
                        },
                        {},
                        ctx,
                        fakeInfo
                    )
                }

                it('returns total count', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(1)
                })

                it('doesnt return total count', async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })
    })
})
