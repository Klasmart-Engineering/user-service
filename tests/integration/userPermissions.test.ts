import { expect } from 'chai'
import { Request } from 'express'
import { Model } from '../../src/model'
import { PermissionName } from '../../src/permissions/permissionNames'
import {
    PermissionContext,
    UserPermissions,
} from '../../src/permissions/userPermissions'
import { superAdminRole } from '../../src/permissions/superAdmin'
import { checkToken, TokenPayload } from '../../src/token'
import { createServer } from '../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import {
    addUserToOrganizationAndValidate,
    createRole,
    createSchool,
} from '../utils/operations/organizationOps'
import {
    createOrganizationAndValidate,
    addOrganizationToUserAndValidate,
    addSchoolToUser,
    userToPayload,
} from '../utils/operations/userOps'
import { getNonAdminAuthToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import chaiAsPromised from 'chai-as-promised'
import chai from 'chai'
import { grantPermission } from '../utils/operations/roleOps'
import { addRoleToSchoolMembership } from '../utils/operations/schoolMembershipOps'
import { addUserToSchool } from '../utils/operations/schoolOps'
import { addRoleToOrganizationMembership } from '../utils/operations/organizationMembershipOps'
import { createOrganization } from '../factories/organization.factory'
import { User } from '../../src/entities/user'
import { Role } from '../../src/entities/role'
import { createRole as createRoleFactory } from '../factories/role.factory'
import { createSchool as createSchoolFactory } from '../factories/school.factory'
import { Status } from '../../src/entities/status'
import { createUser } from '../factories/user.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { Organization } from '../../src/entities/organization'
import { studentRole } from '../../src/permissions/student'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { School } from '../../src/entities/school'
import { buildPermissionError } from '../utils/errors'
chai.use(chaiAsPromised)

describe('userPermissions', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    const req = {
        headers: {},
    } as Request

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('isAdmin', () => {
        let userPermissions: UserPermissions
        let token: TokenPayload

        beforeEach(async () => {
            const encodedToken = getNonAdminAuthToken()
            req.headers = { authorization: encodedToken }
            token = (await checkToken(req)) as TokenPayload
            userPermissions = new UserPermissions(token)
        })

        it('returns false', async () => {
            expect(userPermissions.isAdmin).to.be.false
        })

        context('when user is a super admin', () => {
            beforeEach(async () => {
                const encodedToken = getAdminAuthToken()
                req.headers = { authorization: encodedToken }
                token = (await checkToken(req)) as TokenPayload
                userPermissions = new UserPermissions(token)
            })

            it('returns true', async () => {
                expect(userPermissions.isAdmin).to.be.true
            })
        })

        context('when API key enables super admin', () => {
            beforeEach(async () => {
                userPermissions = new UserPermissions(undefined, true)
            })

            it('returns true', async () => {
                expect(userPermissions.apiKeyAuth).to.be.true
            })
        })
    })

    describe('allowed', () => {
        let user: User
        let org1: Organization
        let org2: Organization
        let orgRole: Role
        let userPermissions: UserPermissions
        let token
        const perm = PermissionName.edit_class_20334

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            org1 = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            org2 = await createOrganization().save()
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                org1.organization_id,
                { authorization: getAdminAuthToken() }
            )
            orgRole = await createRole(
                testClient,
                org1.organization_id,
                'test_role'
            )
            await addRoleToOrganizationMembership(
                testClient,
                user.user_id,
                org1.organization_id,
                orgRole.role_id
            )
        })

        context('when user is not a super admin', () => {
            beforeEach(async () => {
                const encodedToken = getNonAdminAuthToken()
                req.headers = { authorization: encodedToken }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            context('and has permission in an organization', () => {
                beforeEach(async () => {
                    await grantPermission(testClient, orgRole.role_id, perm, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('permission should be validated in the organization', async () => {
                    const permissionContext = {
                        organization_ids: [org1.organization_id],
                    }
                    expect(
                        await userPermissions.allowed(permissionContext, perm)
                    ).to.be.true
                })

                it('permission should not be validated in another organization', async () => {
                    const permissionContext = {
                        organization_ids: [org2.organization_id],
                    }
                    expect(
                        await userPermissions.allowed(permissionContext, perm)
                    ).to.be.false
                })
            })
        })

        context('when the user is a super admin', () => {
            beforeEach(async () => {
                const encodedToken = getAdminAuthToken()
                req.headers = {
                    authorization: encodedToken,
                }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            it('allows all the actions of a super admin', async () => {
                for (const permission of superAdminRole.permissions) {
                    expect(await userPermissions.allowed({}, permission)).to.be
                        .true
                }
            })
        })

        context('when API key enables super admin', () => {
            beforeEach(async () => {
                userPermissions = new UserPermissions(undefined, true)
            })

            it('allows all the actions of a super admin', async () => {
                for (const permission of superAdminRole.permissions) {
                    expect(await userPermissions.allowed({}, permission)).to.be
                        .true
                }
            })
        })
    })

    describe('rejectIfNotAllowed', () => {
        let userPermissions: UserPermissions
        let org1: Organization
        let org2: Organization
        let school1: School
        let school2: School
        let school3: School
        let user: User
        let testOrgRoleId: string
        let testSchoolRoleId: string
        let token
        let permissionContext: PermissionContext
        const perm = PermissionName.edit_class_20334

        const permError = (
            usr: User,
            params?: {
                orgs?: Organization[]
                schools?: School[]
                isDeleted?: boolean
            }
        ): string => {
            return buildPermissionError(
                perm,
                usr,
                params?.orgs,
                params?.schools,
                params?.isDeleted
            )
        }

        beforeEach(async () => {
            // Create Users
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            // Create Organizations
            org1 = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                org1.organization_id,
                { authorization: getAdminAuthToken() }
            )
            org2 = await createOrganization().save()
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                org2.organization_id,
                { authorization: getAdminAuthToken() }
            )
            // Create Schools
            school1 = await createSchool(
                testClient,
                org1.organization_id,
                'my school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            await addUserToSchool(testClient, user.user_id, school1.school_id, {
                authorization: getAdminAuthToken(),
            })
            school2 = await createSchool(
                testClient,
                org1.organization_id,
                'my second school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            school3 = await createSchool(
                testClient,
                org2.organization_id,
                'my third school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            await addUserToSchool(testClient, user.user_id, school2.school_id, {
                authorization: getAdminAuthToken(),
            })
            // Create Roles
            const testOrgRole = await createRole(
                testClient,
                org1.organization_id,
                'test_role'
            )
            testOrgRoleId = testOrgRole.role_id
            await addRoleToOrganizationMembership(
                testClient,
                user.user_id,
                org1.organization_id,
                testOrgRoleId
            )
            const testSchoolRole = await createRole(
                testClient,
                org1.organization_id,
                'test_role'
            )
            testSchoolRoleId = testSchoolRole.role_id
            await addRoleToSchoolMembership(
                testClient,
                user.user_id,
                school1.school_id,
                testSchoolRoleId
            )
        })

        context('when user is not a super admin', () => {
            beforeEach(async () => {
                const encodedToken = getNonAdminAuthToken()
                req.headers = { authorization: encodedToken }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            context('and has no permissions', () => {
                it('should throw error when school ID array is provided', async () => {
                    permissionContext = {
                        school_ids: [school1.school_id],
                        organization_ids: undefined,
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejectedWith(
                        permError(user, { schools: [school1] })
                    )
                })

                it('should throw error when organization ID is provided', async () => {
                    permissionContext = {
                        school_ids: undefined,
                        organization_ids: [org1.organization_id],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejectedWith(permError(user, { orgs: [org1] }))
                })

                it('should throw an error when nothing is provided', async () => {
                    await expect(
                        userPermissions.rejectIfNotAllowed({}, perm)
                    ).to.be.rejectedWith(permError(user))
                })
            })

            context('and is inactive', () => {
                beforeEach(async () => {
                    const dbUser = await User.findOneOrFail(user.user_id)
                    if (dbUser) {
                        dbUser.status = Status.INACTIVE
                        await connection.manager.save(dbUser)
                    }
                })
                it('should throw error when school ID array is provided', async () => {
                    permissionContext = {
                        school_ids: [school1.school_id],
                        organization_ids: undefined,
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejectedWith(permError(user, { isDeleted: true }))
                })

                it('should throw error when organization ID is provided', async () => {
                    permissionContext = {
                        school_ids: undefined,
                        organization_ids: [org1.organization_id],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejected
                })

                it('should make exactly 1 database call', async () => {
                    connection.logger.reset()
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejected
                    expect(connection.logger.count).to.be.eq(1)
                    // 1 to get user
                })
            })

            context('and has permissions for one of the orgs', () => {
                beforeEach(async () => {
                    await grantPermission(testClient, testOrgRoleId, perm, {
                        authorization: getAdminAuthToken(),
                    })
                })

                context(
                    'and checks for permission against that organization',
                    () => {
                        beforeEach(() => {
                            permissionContext = {
                                school_ids: undefined,
                                organization_ids: [org1.organization_id],
                            }
                        })
                        it('passes permission check', async () => {
                            await expect(
                                userPermissions.rejectIfNotAllowed(
                                    permissionContext,
                                    perm
                                )
                            ).to.be.fulfilled
                        })
                        it('should make exactly 2 database calls', async () => {
                            connection.logger.reset()
                            await userPermissions.rejectIfNotAllowed(
                                permissionContext,
                                perm
                            )
                            expect(connection.logger.count).to.be.eq(2) // 1 to get user, 1 to get org permission
                        })
                    }
                )

                it('passes when some empty strings are passed along with that organization', async () => {
                    permissionContext = {
                        school_ids: ['', ''],
                        organization_ids: ['', org1.organization_id, ''],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.fulfilled
                })

                context(
                    "and checks for permission against that org and schools which don't belong to it",
                    () => {
                        beforeEach(() => {
                            permissionContext = {
                                school_ids: [
                                    school1.school_id,
                                    school2.school_id,
                                    school3.school_id,
                                ],
                                organization_ids: [org1.organization_id],
                            }
                        })
                        it('throws permission error', async () => {
                            await expect(
                                userPermissions.rejectIfNotAllowed(
                                    permissionContext,
                                    perm
                                )
                            ).to.be.rejectedWith(
                                permError(user, { schools: [school3] })
                            )
                        })
                        it('should make exactly 3 database calls', async () => {
                            connection.logger.reset()
                            await expect(
                                userPermissions.rejectIfNotAllowed(
                                    permissionContext,
                                    perm
                                )
                            ).to.be.rejected
                            expect(connection.logger.count).to.be.eq(4) // 1 to get user, 1 to check org perms, 2 to check school perms
                        })
                    }
                )

                it('passes with that org and schools which belong to it', async () => {
                    permissionContext = {
                        school_ids: [school1.school_id, school2.school_id],
                        organization_ids: [org1.organization_id],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.fulfilled
                })

                it('errors with organizations where the user does not have permission', async () => {
                    permissionContext = {
                        school_ids: undefined,
                        organization_ids: [
                            org1.organization_id,
                            org2.organization_id,
                        ],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejectedWith(permError(user, { orgs: [org2] }))
                })
            })

            context('and has permissions for one of the schools', () => {
                beforeEach(async () => {
                    await grantPermission(testClient, testSchoolRoleId, perm, {
                        authorization: getAdminAuthToken(),
                    })
                })

                context(
                    'and checks for permissions against that school',
                    () => {
                        beforeEach(() => {
                            permissionContext = {
                                school_ids: [school1.school_id],
                                organization_ids: undefined,
                            }
                        })
                        it('passes permission check', async () => {
                            await expect(
                                userPermissions.rejectIfNotAllowed(
                                    permissionContext,
                                    perm
                                )
                            ).to.be.fulfilled
                        })
                        it('should make exactly 2 database calls', async () => {
                            connection.logger.reset()
                            await userPermissions.rejectIfNotAllowed(
                                permissionContext,
                                perm
                            )
                            expect(connection.logger.count).to.be.eq(2) // 1 to get user, 1 to get school perm
                        })
                    }
                )

                it('passes when some empty strings are passed along with that school', async () => {
                    permissionContext = {
                        school_ids: ['', school1.school_id, ''],
                        organization_ids: ['', ''],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.fulfilled
                })

                it('passes with that school and an org which it belongs to', async () => {
                    permissionContext = {
                        school_ids: [school1.school_id],
                        organization_ids: [org1.organization_id],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.fulfilled
                })

                it('errors with that school and an org which it does not belong to', async () => {
                    permissionContext = {
                        school_ids: [school1.school_id],
                        organization_ids: [org2.organization_id],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejectedWith(permError(user, { orgs: [org2] }))
                })

                it('errors with schools and orgs where the user does not have permission', async () => {
                    const org3 = await createOrganization().save()
                    permissionContext = {
                        school_ids: [
                            school1.school_id,
                            school2.school_id,
                            school3.school_id,
                        ],
                        organization_ids: [
                            org1.organization_id,
                            org2.organization_id,
                            org3.organization_id,
                        ],
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            perm
                        )
                    ).to.be.rejectedWith(
                        permError(user, {
                            orgs: [org1, org2, org3],
                            schools: [school2, school3],
                        })
                    )
                })
            })
        })

        context('when the user is a super admin', () => {
            beforeEach(async () => {
                const encodedToken = getAdminAuthToken()
                req.headers = {
                    authorization: encodedToken,
                }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            permissionContext = {}

            it('allows all the actions of a super admin', async () => {
                for (const permission of superAdminRole.permissions) {
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            permission
                        )
                    ).to.be.fulfilled
                }
            })

            it('should make exactly 1 database call', async () => {
                connection.logger.reset()
                await userPermissions.rejectIfNotAllowed(
                    permissionContext,
                    superAdminRole.permissions[0]
                )
                expect(connection.logger.count).to.be.eq(1)
                // 1 to get user
            })
        })

        context('when API key enables super admin', () => {
            beforeEach(async () => {
                userPermissions = new UserPermissions(undefined, true)
            })

            permissionContext = {}

            it('allows all the actions of a super admin', async () => {
                for (const permission of superAdminRole.permissions) {
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            permission
                        )
                    ).to.be.fulfilled
                }
            })

            it('should make exactly 0 database calls', async () => {
                connection.logger.reset()
                await userPermissions.rejectIfNotAllowed(
                    permissionContext,
                    superAdminRole.permissions[0]
                )
                expect(connection.logger.count).to.be.eq(0)
                // 1 to get user
            })
        })
    })

    context('memberships with permissions', () => {
        let userPermissions: UserPermissions
        let nonAdmin: User
        let roles: Role[] = []

        let orgs = []
        beforeEach(async () => {
            roles = []
            orgs = []
            nonAdmin = await createNonAdminUser(testClient)
            const encodedToken = getNonAdminAuthToken()
            req.headers = { authorization: encodedToken }
            const token = (await checkToken(req)) as TokenPayload
            token.id = nonAdmin.user_id
            userPermissions = new UserPermissions(token)

            const superAdmin = await createAdminUser(testClient)

            for (let i = 0; i < 2; i++) {
                const org = createOrganization(superAdmin)
                await connection.manager.save(org)
                orgs.push(org)

                const role = await createRoleFactory('role', org)
                await connection.manager.save(role)
                roles.push(role)

                const school = createSchoolFactory(org)
                await connection.manager.save(school)

                await addOrganizationToUserAndValidate(
                    testClient,
                    userPermissions.getUserId()!,
                    org.organization_id,
                    getAdminAuthToken()
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    userPermissions.getUserId()!,
                    org.organization_id,
                    role.role_id,
                    { authorization: getAdminAuthToken() }
                )

                await addSchoolToUser(
                    testClient,
                    userPermissions.getUserId()!,
                    school.school_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    userPermissions.getUserId()!,
                    school.school_id,
                    role.role_id,
                    { authorization: getAdminAuthToken() }
                )
            }
        })

        describe('orgMembershipsWithPermissions', () => {
            it('includes all organizations you are a member if no permissions are provided', async () => {
                const orgIds = await userPermissions?.orgMembershipsWithPermissions(
                    []
                )
                expect(orgIds.length).to.eq(2)
            })
            context(
                'returns orgs with memberships with ALL permissions',
                () => {
                    it('returns no orgs if the user is missing one of the permissions', async () => {
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_users_40110,
                            { authorization: getAdminAuthToken() }
                        )
                        const orgIds = await userPermissions?.orgMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'AND'
                        )
                        expect(orgIds.length).to.eq(0)
                    })
                    it('returns orgs if the user has ALL permissions', async () => {
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_users_40110,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_user_page_40101,
                            { authorization: getAdminAuthToken() }
                        )
                        const orgIds = await userPermissions?.orgMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'AND'
                        )
                        expect(orgIds.length).to.eq(1)
                    })
                }
            )

            context(
                'returns orgs with memberships with ANY permissions',
                () => {
                    it("returns no orgs if the user doesn't have any of the permissions", async () => {
                        const orgIds = await userPermissions?.orgMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'OR'
                        )
                        expect(orgIds.length).to.eq(0)
                    })
                    it('returns orgs if the user has ANY of the permissions', async () => {
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_users_40110,
                            { authorization: getAdminAuthToken() }
                        )
                        const orgIds = await userPermissions?.orgMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'OR'
                        )
                        expect(orgIds.length).to.eq(1)
                    })
                }
            )
        })

        describe('schoolMembershipsWithPermissions', () => {
            it('returns all schools you are a member of if no permissions are provided', async () => {
                const schoolIds = await userPermissions?.schoolMembershipsWithPermissions(
                    []
                )
                expect(schoolIds.length).to.eq(2)
            })

            context(
                'returns school with memberships with ALL permissions',
                () => {
                    it("returns no schools if the user doesn't have any the permissions", async () => {
                        const schoolIds = await userPermissions?.orgMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'AND'
                        )
                        expect(schoolIds.length).to.eq(0)
                    })
                    it('returns no schools if the user is missing one of the permissions', async () => {
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_users_40110,
                            { authorization: getAdminAuthToken() }
                        )
                        const schoolIds = await userPermissions?.schoolMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'AND'
                        )
                        expect(schoolIds.length).to.eq(0)
                    })
                    it('returns schools if the user has ALL permissions', async () => {
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_users_40110,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_user_page_40101,
                            { authorization: getAdminAuthToken() }
                        )
                        const schoolIds = await userPermissions?.schoolMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'AND'
                        )
                        expect(schoolIds.length).to.eq(1)
                    })
                }
            )

            context(
                'returns schools with memberships with ANY permissions',
                () => {
                    it("returns no schools if the user doesn't have any the permissions", async () => {
                        const schoolIds = await userPermissions?.schoolMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'OR'
                        )
                        expect(schoolIds.length).to.eq(0)
                    })
                    it('returns schools if the user has ANY of the permissions', async () => {
                        await grantPermission(
                            testClient,
                            roles[0].role_id,
                            PermissionName.view_users_40110,
                            { authorization: getAdminAuthToken() }
                        )
                        const schoolIds = await userPermissions?.schoolMembershipsWithPermissions(
                            [
                                PermissionName.view_users_40110,
                                PermissionName.view_user_page_40101,
                            ],
                            'OR'
                        )
                        expect(schoolIds.length).to.eq(1)
                    })
                }
            )
        })
    })

    describe('permissionsInOrganization', () => {
        let clientUser: User
        let organization: Organization
        let userPermissions: UserPermissions
        beforeEach(async () => {
            clientUser = await createUser().save()
            organization = await createOrganization().save()
            userPermissions = new UserPermissions(userToPayload(clientUser))
        })
        it('returns an empty array if the user is not part of the organization', async () => {
            const permissions = await userPermissions.permissionsInOrganization(
                organization.organization_id
            )
            expect(permissions).to.have.lengthOf(0)
        })
        it('returns the full list of permissions a user has in a given organization', async () => {
            const role = await createRoleFactory('role', organization, {
                permissions: studentRole.permissions,
            }).save()
            await createOrganizationMembership({
                user: clientUser,
                organization,
                roles: [role],
            }).save()
            const permissions = await userPermissions.permissionsInOrganization(
                organization.organization_id
            )
            expect(permissions).to.have.lengthOf(studentRole.permissions.length)
        })
    })
    describe('permissionsInSchool', () => {
        let clientUser: User
        let school: School
        let userPermissions: UserPermissions
        beforeEach(async () => {
            clientUser = await createUser().save()
            school = await createSchoolFactory().save()
            userPermissions = new UserPermissions(userToPayload(clientUser))
        })
        it('returns an empty array if the user is not part of the school', async () => {
            const permissions = await userPermissions.permissionsInSchool(
                school.school_id
            )
            expect(permissions).to.have.lengthOf(0)
        })
        it('returns the full list of permissions a user has in a given school', async () => {
            const role = await createRoleFactory('role', undefined, {
                permissions: studentRole.permissions,
            }).save()
            await createSchoolMembership({
                user: clientUser,
                school,
                roles: [role],
            }).save()
            const permissions = await userPermissions.permissionsInSchool(
                school.school_id
            )
            expect(permissions).to.have.lengthOf(studentRole.permissions.length)
        })
    })
})
