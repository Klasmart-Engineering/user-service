import { expect, use } from 'chai'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import chaiAsPromised from 'chai-as-promised'
import { User } from '../../src/entities/user'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { createUser } from '../factories/user.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganization } from '../factories/organization.factory'
import { createRole } from '../factories/role.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { createServer } from '../../src/utils/createServer'
import { Model } from '../../src/model'
import {
    myUserOrganizationsWithPermissions,
    myUserSchoolsWithPermissions,
} from '../utils/operations/modelOps'
import { generateToken } from '../utils/testConfig'
import { School } from '../../src/entities/school'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { paginatePermissions } from '../../src/schemas/myUser'
import { Permission } from '../../src/entities/permission'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { GraphQLResolveInfo } from 'graphql'
import { organizationAdminRole } from '../../src/permissions/organizationAdmin'
import { IEntityFilter } from '../../src/utils/pagination/filtering'
import { createAdminUser } from '../utils/testEntities'
import { userToPayload } from '../utils/operations/userOps'

use(chaiAsPromised)

describe('myUser', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    context('MyUser.XWithPermissions', () => {
        let clientUser: User
        let org1: Organization
        let org2: Organization
        let org3: Organization
        let role1: Role
        let role2: Role
        let role3: Role
        let permissionIds: PermissionName[]
        let authToken: string

        beforeEach(async () => {
            clientUser = await createUser().save()
            permissionIds = [
                PermissionName.view_users_40110, // This will be applied to org1+school1
                PermissionName.view_school_classes_20117, // This will be applied to org2+org3, school2+school3
                PermissionName.view_classes_20114, // This will be applied to org3+school3
            ]
            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            org3 = await createOrganization().save()

            role1 = await createRole(undefined, org1, {
                permissions: [
                    permissionIds[0],
                    PermissionName.view_school_20110, // Helper permission for showing school responses in schoolsWithPermissions
                ],
            }).save()
            role2 = await createRole(undefined, org2, {
                permissions: [
                    permissionIds[1],
                    PermissionName.view_school_20110, // Helper permission for showing school responses in schoolsWithPermissions
                ],
            }).save()
            role3 = await createRole(undefined, org3, {
                permissions: [
                    permissionIds[1],
                    permissionIds[2],
                    PermissionName.view_school_20110, // Helper permission for showing school responses in schoolsWithPermissions
                ],
            }).save()

            const orgs = [org1, org2, org3],
                roles = [role1, role2, role3]
            for (let i = 0; i < orgs.length; i++) {
                await createOrganizationMembership({
                    user: clientUser,
                    organization: orgs[i],
                    roles: [roles[i]],
                }).save()
            }

            authToken = generateToken({
                id: clientUser.user_id,
                email: clientUser.email,
                iss: 'calmid-debug',
            })
        })

        context('Organizations', () => {
            it('fetches only organizations which the user has the checked permissions in (OR mode)', async () => {
                permissionIds = [
                    // This list doesn't include the 1st permission
                    PermissionName.view_school_classes_20117,
                    PermissionName.view_classes_20114,
                ]
                const operator = 'OR'

                const result = await myUserOrganizationsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    operator,
                    { authorization: authToken }
                )

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    // This list should omit org1 because its permission wasn't queried for
                    org2.organization_id,
                    org3.organization_id,
                ])
            })

            it('fetches only organizations which the user has the checked permissions in (AND mode)', async () => {
                permissionIds = [
                    // This list doesn't include the 1st permission
                    PermissionName.view_school_classes_20117,
                    PermissionName.view_classes_20114,
                ]
                const operator = 'AND'

                const result = await myUserOrganizationsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    operator,
                    { authorization: authToken }
                )
                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    // This is the only org to have both permissions
                    org3.organization_id,
                ])
            })

            it('fetches all organizations the user is a member of if no permissions checked', async () => {
                permissionIds = []

                const result = await myUserOrganizationsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    undefined,
                    { authorization: authToken }
                )
                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    org1.organization_id,
                    org2.organization_id,
                    org3.organization_id,
                ])
            })

            it('returns empty response if the checked permission is not assigned to the user anywhere', async () => {
                permissionIds = [
                    // Not assigned in any org membership role to the user
                    PermissionName.view_org_completed_assessments_424,
                ]
                const operator = 'OR'

                const result = await myUserOrganizationsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    operator,
                    { authorization: authToken }
                )

                expect(result.edges).to.be.empty
            })
        })

        context('Schools', () => {
            let school1: School
            let school2: School
            let school3: School

            beforeEach(async () => {
                school1 = await createSchool(org1).save()
                school2 = await createSchool(org2).save()
                school3 = await createSchool(org3).save()
                const schools = [school1, school2, school3],
                    roles = [role1, role2, role3]
                for (let i = 0; i < schools.length; i++) {
                    await createSchoolMembership({
                        user: clientUser,
                        school: schools[i],
                        roles: [roles[i]],
                    }).save()
                }
            })

            it('fetches only schools which the user has the checked permissions in (OR mode)', async () => {
                permissionIds = [
                    // This list doesn't include the 1st permission
                    PermissionName.view_school_classes_20117,
                    PermissionName.view_classes_20114,
                ]
                const operator = 'OR'

                const result = await myUserSchoolsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    operator,
                    { authorization: authToken }
                )

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    // This list should omit school1 because its permission wasn't queried for
                    school2.school_id,
                    school3.school_id,
                ])
            })

            it('fetches only schools which the user has the checked permissions in (AND mode)', async () => {
                permissionIds = [
                    // This list doesn't include the 1st permission
                    PermissionName.view_school_classes_20117,
                    PermissionName.view_classes_20114,
                ]
                const operator = 'AND'

                const result = await myUserSchoolsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    operator,
                    { authorization: authToken }
                )

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    // This is the only org to have both permissions
                    school3.school_id,
                ])
            })

            it('fetches all schools the user is a member of if no permissions checked', async () => {
                permissionIds = []

                const result = await myUserSchoolsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    undefined,
                    { authorization: authToken }
                )

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    school1.school_id,
                    school2.school_id,
                    school3.school_id,
                ])
            })

            it('returns empty response if the checked permission is not assigned to the user anywhere', async () => {
                permissionIds = [
                    // Not assigned in any org membership role to the user
                    PermissionName.view_org_completed_assessments_424,
                ]

                const result = await myUserSchoolsWithPermissions(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    false,
                    permissionIds,
                    undefined,
                    { authorization: authToken }
                )

                expect(result.edges).to.be.empty
            })
        })
    })

    describe('#paginatePermissions', () => {
        const paginationCount = 10

        let adminUser: User
        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
        })

        async function getResult(
            permissions: PermissionName[],
            filter?: IEntityFilter
        ) {
            return paginatePermissions(
                permissions,
                Permission.createQueryBuilder(),
                {
                    count: paginationCount,
                    filter,
                },
                ({
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
                } as unknown) as GraphQLResolveInfo,
                new UserPermissions(userToPayload(adminUser))
            )
        }

        it('returns a paginated list of permissions provided', async () => {
            const result = await getResult(organizationAdminRole.permissions)
            expect(result.totalCount).to.eq(
                organizationAdminRole.permissions.length
            )
            expect(result.edges).to.have.lengthOf(paginationCount)
        })
        it('returns an empty paginated response if no permissions are provided', async () => {
            const result = await getResult([])
            expect(result.totalCount).to.eq(0)
            expect(result.edges).to.have.lengthOf(0)
        })
        it('supports additional filtering', async () => {
            const result = await getResult(organizationAdminRole.permissions, {
                name: {
                    operator: 'eq',
                    value: organizationAdminRole.permissions[0],
                },
            })
            expect(result.totalCount).to.eq(1)
            expect(result.edges).to.have.lengthOf(1)
        })
    })
})
