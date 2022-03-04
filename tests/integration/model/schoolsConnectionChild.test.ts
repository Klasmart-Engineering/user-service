import { Organization } from '../../../src/entities/organization'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import { TestConnection } from '../../utils/testConnection'
import { createOrganization } from '../../factories/organization.factory'
import { createUser } from '../../factories/user.factory'
import { User } from '../../../src/entities/user'
import { expect } from 'chai'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { Role } from '../../../src/entities/role'
import { createRole } from '../../factories/role.factory'
import {
    schoolsChildConnection as orgSchoolsChildConnection,
    schoolsChildConnectionResolver as orgSchoolsChildConnectionResolver,
} from '../../../src/schemas/organization'
import {
    schoolsChildConnection as classSchoolsChildConnection,
    schoolsChildConnectionResolver as classSchoolsChildConnectionResolver,
} from '../../../src/schemas/class'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { Context } from '../../../src/main'
import { GraphQLResolveInfo } from 'graphql'
import { School } from '../../../src/entities/school'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createSchool } from '../../factories/school.factory'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Class } from '../../../src/entities/class'
import { createClass } from '../../factories/class.factory'
import { getConnection } from 'typeorm'

describe('schoolsChildConnection', async () => {
    let connection: TestConnection
    let ctx: Pick<Context, 'loaders'>

    let clientUserRole1: Role
    let clientUserRole2: Role
    let clientUser: User
    let otherUser: User
    let bothUsersOrg: Organization
    let clientUsersOrg: Organization
    let clientUserSchool: School
    let clientUserSpookySchool: School
    let otherUsersOrg: Organization
    let otherUserSchool: School
    let bothUserSchool: School
    let clientUserClass: Class
    let clientUserNightClass: Class

    let schoolMemberships: Map<User, School[]>

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        clientUsersOrg = await createOrganization().save()
        otherUsersOrg = await createOrganization().save()
        bothUsersOrg = await createOrganization().save()
        clientUserSchool = await createSchool(clientUsersOrg, 'Scoo').save()
        clientUserSpookySchool = await createSchool(
            clientUsersOrg,
            'Boo'
        ).save()
        otherUserSchool = await createSchool(otherUsersOrg, 'By').save()
        bothUserSchool = await createSchool(bothUsersOrg, 'Doo').save()

        clientUser = await createUser().save()
        otherUser = await createUser().save()
        clientUserRole1 = await createRole(undefined, clientUsersOrg, {
            permissions: [
                PermissionName.view_school_20110,
                PermissionName.view_my_school_20119,
            ],
        }).save()
        clientUserRole2 = await createRole(undefined, bothUsersOrg, {
            permissions: [
                PermissionName.view_school_20110,
                PermissionName.view_my_school_20119,
            ],
        }).save()

        await createOrganizationMembership({
            user: clientUser,
            organization: clientUsersOrg,
            roles: [clientUserRole1],
        }).save()
        await createOrganizationMembership({
            user: clientUser,
            organization: bothUsersOrg,
            roles: [clientUserRole2],
        }).save()
        await createOrganizationMembership({
            user: otherUser,
            organization: otherUsersOrg,
        }).save()
        await createOrganizationMembership({
            user: otherUser,
            organization: bothUsersOrg,
        }).save()

        schoolMemberships = new Map([
            [clientUser, [clientUserSchool, bothUserSchool]],
            [otherUser, [otherUserSchool, bothUserSchool]],
        ])

        for (const [user, schools] of schoolMemberships) {
            for (const school of schools) {
                await createSchoolMembership({
                    user,
                    school,
                }).save()
            }
        }

        const token = { id: clientUser.user_id }
        const permissions = new UserPermissions(token)
        ctx = { loaders: createContextLazyLoaders(permissions) }
    })

    context('organizationsConnection parent', async () => {
        beforeEach(async () => {
            await createSchoolMembership({
                user: clientUser,
                school: clientUserSpookySchool,
            }).save()
        })

        it('returns correct schools for an org', async () => {
            const args: IChildPaginationArgs = {
                direction: 'FORWARD',
                count: 2,
            }

            const result = await orgSchoolsChildConnection(
                { id: clientUsersOrg.organization_id },
                args,
                ctx.loaders,
                false
            )

            const expectedOrgSchools = await clientUsersOrg.schools

            expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                expectedOrgSchools!.map((school) => school.school_id)
            )
        })

        it('uses exactly one dataloader when called with different orgs', async () => {
            connection.logger.reset()

            const loaderResults = []
            for (const org of [clientUsersOrg, otherUsersOrg]) {
                const loaderResult = orgSchoolsChildConnection(
                    { id: org.organization_id },
                    {},
                    ctx.loaders,
                    false
                )
                loaderResults.push(loaderResult)
            }

            await Promise.all(loaderResults)
            // one query for school permissions
            // one query for organization permissions
            // one query for fetching users
            expect(connection.logger.count).to.be.eq(3)
        })

        context('totalCount', async () => {
            let fakeInfo: any

            beforeEach(() => {
                fakeInfo = {
                    fieldNodes: [
                        {
                            kind: 'Field',
                            name: {
                                kind: 'Name',
                                value: 'schoolsConnection',
                            },
                            selectionSet: {
                                kind: 'SelectionSet',
                                selections: [],
                            },
                        },
                    ],
                }
            })

            const callResolver = (
                fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
            ) => {
                return orgSchoolsChildConnectionResolver(
                    { id: clientUsersOrg.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
            }

            it('returns total count', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })

                const result = await callResolver(fakeInfo)
                expect(result.totalCount).to.eq(
                    schoolMemberships.get(clientUser)!.length
                )
            })

            it('doesnt return total count', async () => {
                const result = await callResolver(fakeInfo)
                expect(result.totalCount).to.eq(undefined)
            })
        })
    })

    context('classesConnection parent', async () => {
        beforeEach(async () => {
            clientUserClass = await createClass(
                [clientUserSchool, clientUserSpookySchool],
                clientUsersOrg
            ).save()
            clientUserNightClass = await createClass(
                [clientUserSchool, clientUserSpookySchool],
                clientUsersOrg
            ).save()
        })
        it('returns correct schools for a class', async () => {
            const args: IChildPaginationArgs = {
                direction: 'FORWARD',
                count: 2,
            }

            const result = await classSchoolsChildConnection(
                { id: clientUserClass.class_id },
                args,
                ctx.loaders,
                false
            )

            const expectedClassSchools = await clientUsersOrg.schools

            expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                expectedClassSchools!.map((school) => school.school_id)
            )
        })

        it('uses exactly one dataloader when called with different orgs', async () => {
            connection.logger.reset()

            const loaderResults = []
            for (const class_ of [clientUserClass, clientUserNightClass]) {
                const loaderResult = classSchoolsChildConnection(
                    { id: class_.class_id },
                    {},
                    ctx.loaders,
                    false
                )
                loaderResults.push(loaderResult)
            }

            await Promise.all(loaderResults)
            // one query for school permissions
            // one query for organization permissions
            // one query for fetching users
            expect(connection.logger.count).to.be.eq(3)
        })

        context('totalCount', async () => {
            let fakeInfo: any

            beforeEach(() => {
                fakeInfo = {
                    fieldNodes: [
                        {
                            kind: 'Field',
                            name: {
                                kind: 'Name',
                                value: 'schoolsConnection',
                            },
                            selectionSet: {
                                kind: 'SelectionSet',
                                selections: [],
                            },
                        },
                    ],
                }
            })

            const callResolver = (
                fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
            ) => {
                return classSchoolsChildConnectionResolver(
                    { id: clientUserClass.class_id },
                    {},
                    ctx,
                    fakeInfo
                )
            }

            it('returns total count', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })

                const result = await callResolver(fakeInfo)
                expect(result.totalCount).to.eq(
                    schoolMemberships.get(clientUser)!.length
                )
            })

            it('doesnt return total count', async () => {
                const result = await callResolver(fakeInfo)
                expect(result.totalCount).to.eq(undefined)
            })
        })
    })
})
