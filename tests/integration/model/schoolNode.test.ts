import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { SelectQueryBuilder } from 'typeorm'
import { nonAdminSchoolScope } from '../../../src/directives/isAdmin'
import { Organization } from '../../../src/entities/organization'
import { School } from '../../../src/entities/school'
import { User } from '../../../src/entities/user'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { ISchoolsConnectionNode } from '../../../src/types/graphQL/schoolsConnectionNode'
import { createServer } from '../../../src/utils/createServer'
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
import { school2Nodes } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

use(deepEqualInAnyOrder)

function expectSchoolConnectionEdge(
    queryResult: ISchoolsConnectionNode,
    schoolToCompare: School
) {
    expect(queryResult.id).to.eql(schoolToCompare.school_id)
    expect(queryResult.name).to.eql(schoolToCompare.school_name)
    expect(queryResult.status).to.eql(schoolToCompare.status)
    expect(queryResult.shortCode).to.eql(schoolToCompare.shortcode)
}

use(chaiAsPromised)

describe('scholNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org3: Organization
    let org1Schools: School[] = []
    let org2Schools: School[] = []
    let org3Schools: School[] = []
    const schools: School[] = []
    let scope: SelectQueryBuilder<School>
    let adminPermissions: UserPermissions
    let orgOwnerPermissions: UserPermissions
    let schoolAdminPermissions: UserPermissions
    let orgMemberPermissions: UserPermissions
    let ownerAndSchoolAdminPermissions: UserPermissions
    const schoolsCount = 12

    // emulated ctx object to could test resolver
    let ctx: Context

    const buildScopeAndContext = async (permissions: UserPermissions) => {
        if (!permissions.isAdmin) {
            await nonAdminSchoolScope(scope, permissions)
        }

        ctx = ({
            permissions,
            loaders: createContextLazyLoaders(),
        } as unknown) as Context
    }

    const getSchoolNode = async (schoolId: string) => {
        const coreResult = (await ctx.loaders.schoolNode.node.instance.load({
            scope,
            id: schoolId,
        })) as ISchoolsConnectionNode

        return {
            coreResult,
        }
    }

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        scope = School.createQueryBuilder('School')

        admin = await createAdminUser(testClient)
        org1 = await createOrganization().save()
        org2 = await createOrganization().save()
        org3 = await createOrganization().save()

        // creating org1 schools
        org1Schools = await School.save(
            Array.from(Array(schoolsCount), (_, i) => {
                const s = createSchool(org1)
                s.school_name = `school ${i}`
                return s
            })
        )

        // creating org2 schools
        org2Schools = await School.save(
            Array.from(Array(schoolsCount), (_, i) => {
                const c = createSchool(org2)
                c.school_name = `school ${i}`
                return c
            })
        )

        // creating org3 schools
        org3Schools = await School.save(
            Array.from(Array(schoolsCount), (_, i) => {
                const s = createSchool(org3)
                s.school_name = `school ${i}`
                return s
            })
        )

        schools.push(...org1Schools, ...org2Schools, ...org3Schools)

        adminPermissions = new UserPermissions(userToPayload(admin))

        // Emulating context
        await buildScopeAndContext(adminPermissions)
    })

    context('data', () => {
        beforeEach(async () => {
            org1Schools.forEach(async (c, i) => {
                await c.save()
            })
        })

        it('should get the correct school with its corresponding data', async () => {
            const schoolToTest = org1Schools[0]
            const { coreResult } = await getSchoolNode(schoolToTest.school_id)

            expect(coreResult).to.be.an('object')
            expectSchoolConnectionEdge(coreResult, schoolToTest)
        })
    })

    context('database calls', () => {
        it('makes just one call to the database', async () => {
            const schoolToTest1 = org1Schools[0]
            const schoolToTest2 = org1Schools[1]

            connection.logger.reset()

            await school2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                schoolToTest1.school_id,
                schoolToTest2.school_id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('permissions', () => {
        let aliases: string[]
        let conditions: string[]

        beforeEach(async () => {
            const orgOwner = await createUser().save()
            const schoolAdmin = await createUser().save()
            const orgMember = await createUser().save()
            const ownerAndSchoolAdmin = await createUser().save()

            const viewAllSchoolsRoleOrg3 = await createRole(
                'View Schools',
                org3,
                {
                    permissions: [PermissionName.view_school_20110],
                }
            ).save()

            const viewAllSchoolsFromTheOrgRole = await createRole(
                'View Schools',
                org2,
                {
                    permissions: [PermissionName.view_school_20110],
                }
            ).save()

            const viewMySchoolRole = await createRole('View My School', org3, {
                permissions: [PermissionName.view_my_school_20119],
            }).save()

            // adding orgOwner to org3 with orgAdminRole¿
            await createOrganizationMembership({
                user: orgOwner,
                organization: org3,
                roles: [viewAllSchoolsRoleOrg3],
            }).save()

            // adding ownerAndSchoolAdmin to org2 with orgAdminRole
            await createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org2,
                roles: [viewAllSchoolsFromTheOrgRole],
            }).save()

            // adding schoolAdmin to org3 with schoolAdminRole
            await createOrganizationMembership({
                user: schoolAdmin,
                organization: org3,
                roles: [viewMySchoolRole],
            }).save()

            // adding schoolAdmin to first org3School
            await createSchoolMembership({
                user: schoolAdmin,
                school: org3Schools[0],
                roles: [viewMySchoolRole],
            }).save()

            // adding ownerAndSchoolAdmin to org3 with schoolAdminRole
            await createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org3,
                roles: [viewMySchoolRole],
            }).save()

            // adding ownerAndSchoolAdmin to second org3School
            await createSchoolMembership({
                user: ownerAndSchoolAdmin,
                school: org3Schools[1],
                roles: [viewMySchoolRole],
            }).save()

            // adding orgMember to org3
            await createOrganizationMembership({
                user: orgMember,
                organization: org3,
                roles: [],
            }).save()

            orgOwnerPermissions = new UserPermissions(userToPayload(orgOwner))
            schoolAdminPermissions = new UserPermissions(
                userToPayload(schoolAdmin)
            )
            orgMemberPermissions = new UserPermissions(userToPayload(orgMember))
            ownerAndSchoolAdminPermissions = new UserPermissions(
                userToPayload(ownerAndSchoolAdmin)
            )
        })

        it('super admin should get any school', async () => {
            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)

            expect(aliases.length).to.eq(1)
            expect(aliases).to.deep.equalInAnyOrder(['School'])

            expect(conditions.length).to.eq(0)
        })

        it('org admin should get a school just from its organization', async () => {
            await buildScopeAndContext(orgOwnerPermissions)

            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)

            expect(aliases.length).to.eq(2)
            expect(aliases).to.deep.equalInAnyOrder([
                'School',
                'OrganizationMembership',
            ])

            expect(conditions.length).to.eq(0)
        })

        it('school admin should get his/her schools', async () => {
            await buildScopeAndContext(schoolAdminPermissions)

            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)

            expect(aliases.length).to.eq(2)
            expect(aliases).to.deep.equalInAnyOrder([
                'School',
                'SchoolMembership',
            ])

            expect(conditions.length).to.eq(0)
        })

        it('owner and school admin should get a school of them or its organisation', async () => {
            await buildScopeAndContext(ownerAndSchoolAdminPermissions)

            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)
            expect(conditions.length).to.eq(1)
            expect(conditions).to.deep.equalInAnyOrder([
                '(OrganizationMembership.user IS NOT NULL OR SchoolMembership.user IS NOT NULL)',
            ])
        })

        context('permissons error handling', () => {
            it('throws an error if an org admin tries to get a school out of its organisation', async () => {
                await buildScopeAndContext(orgOwnerPermissions)
                const schoolToTest = org1Schools[0]
                await expect(
                    ctx.loaders.schoolNode.node.instance.load({
                        scope,
                        id: schoolToTest.school_id,
                    })
                ).to.be.rejected
            })

            it('throws an error if a non admin user tries to get a school', async () => {
                await buildScopeAndContext(orgMemberPermissions)
                const schoolToTest = org1Schools[0]

                await expect(
                    ctx.loaders.schoolNode.node.instance.load({
                        scope,
                        id: schoolToTest.school_id,
                    })
                ).to.be.rejected
            })
        })
    })

    context('input error handling', () => {
        it('throws an error if id is not a ID', async () => {
            await expect(
                ctx.loaders.schoolNode.node.instance.load({
                    scope,
                    id: '1-4m-n07-4n-1d',
                })
            ).to.be.rejected
        })

        it("throws an error if id doesn't exist", async () => {
            await expect(
                ctx.loaders.schoolNode.node.instance.load({
                    scope,
                    id: '00000000-0000-0000-0000-00000',
                })
            ).to.be.rejected
        })
    })
})
