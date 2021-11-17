import { expect } from 'chai'
import { Connection } from 'typeorm'
import { Request } from 'express'
import { School } from '../../src/entities/school'
import { Model } from '../../src/model'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
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
import {
    getNonAdminAuthToken,
    getAdminAuthToken,
    generateToken,
} from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
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
chai.use(chaiAsPromised)

describe('userPermissions', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let originalAdmins: string[]
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
            token = await checkToken(req)
            userPermissions = new UserPermissions(token)
        })

        it('returns false', async () => {
            expect(userPermissions.isAdmin).to.be.false
        })

        context('when user is a super admin', () => {
            beforeEach(async () => {
                const encodedToken = getAdminAuthToken()
                req.headers = { authorization: encodedToken }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            it('returns true', async () => {
                expect(userPermissions.isAdmin).to.be.true
            })
        })
    })

    describe('rejectIfNotAllowed', () => {
        let userPermissions: UserPermissions
        let schoolId: string
        let organizationId: string
        let userId: string
        let testOrgRoleId: string
        let testSchoolRoleId: string
        let token

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            const user = await createNonAdminUser(testClient)
            userId = user.user_id
            const organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            organizationId = organization.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            const school = await createSchool(
                testClient,
                organizationId,
                'my school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            schoolId = school.school_id
            await addUserToSchool(testClient, userId, schoolId, {
                authorization: getAdminAuthToken(),
            })
            const testOrgRole = await createRole(
                testClient,
                organizationId,
                'test_role'
            )
            testOrgRoleId = testOrgRole.role_id
            await addRoleToOrganizationMembership(
                testClient,
                userId,
                organizationId,
                testOrgRoleId
            )
            const testSchoolRole = await createRole(
                testClient,
                organizationId,
                'test_role'
            )
            testSchoolRoleId = testSchoolRole.role_id
            await addRoleToSchoolMembership(
                testClient,
                userId,
                schoolId,
                testSchoolRoleId
            )
        })

        context("when user role doesn't include specified permission", () => {
            beforeEach(async () => {
                const encodedToken = getNonAdminAuthToken()
                req.headers = { authorization: encodedToken }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            it('should throw error when school ID array is provided', async () => {
                const permissionContext = {
                    school_id: undefined,
                    school_ids: [schoolId],
                    organization_id: undefined,
                }
                await expect(
                    userPermissions.rejectIfNotAllowed(
                        permissionContext,
                        PermissionName.edit_class_20334
                    )
                ).to.be.rejected
            })

            it('should throw error when organization ID is provided', async () => {
                const permissionContext = {
                    school_id: undefined,
                    school_ids: undefined,
                    organization_id: organizationId,
                }
                await expect(
                    userPermissions.rejectIfNotAllowed(
                        permissionContext,
                        PermissionName.edit_class_20334
                    )
                ).to.be.rejected
            })
        })

        context('when user role does include specified permission', () => {
            beforeEach(async () => {
                const encodedToken = getNonAdminAuthToken()
                req.headers = { authorization: encodedToken }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            context('and the role is active', () => {
                it('should not throw error when school ID array is provided', async () => {
                    await grantPermission(
                        testClient,
                        testSchoolRoleId,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                    const permissionContext = {
                        school_id: undefined,
                        school_ids: [schoolId],
                        organization_id: undefined,
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            PermissionName.edit_class_20334
                        )
                    ).to.be.fulfilled
                })

                it('should not throw error when organization ID is provided', async () => {
                    await grantPermission(
                        testClient,
                        testOrgRoleId,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                    const permissionContext = {
                        school_id: undefined,
                        school_ids: undefined,
                        organization_id: organizationId,
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            PermissionName.edit_class_20334
                        )
                    ).to.be.fulfilled
                })

                it("should not throw error when user dosn't have organization permission, but does have permission for at least one school", async () => {
                    await grantPermission(
                        testClient,
                        testSchoolRoleId,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                    const permissionContext = {
                        school_id: undefined,
                        school_ids: [schoolId],
                        organization_id: organizationId,
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            PermissionName.edit_class_20334
                        )
                    ).to.be.fulfilled
                })
            })

            context('and the user is inactive', () => {
                beforeEach(async () => {
                    const dbUser = await User.findOneOrFail(userId)
                    if (dbUser) {
                        dbUser.status = Status.INACTIVE
                        await connection.manager.save(dbUser)
                    }
                })
                it('should throw error when school ID array is provided', async () => {
                    const permissionContext = {
                        school_id: undefined,
                        school_ids: [schoolId],
                        organization_id: undefined,
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            PermissionName.edit_class_20334
                        )
                    ).to.be.rejected
                })

                it('should throw error when organization ID is provided', async () => {
                    const permissionContext = {
                        school_id: undefined,
                        school_ids: undefined,
                        organization_id: organizationId,
                    }
                    await expect(
                        userPermissions.rejectIfNotAllowed(
                            permissionContext,
                            PermissionName.edit_class_20334
                        )
                    ).to.be.rejected
                })
            })
        })

        context('when the user is super admin', () => {
            beforeEach(async () => {
                const encodedToken = getAdminAuthToken()
                req.headers = {
                    authorization: encodedToken,
                }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })

            const permissionContext = {}

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
        })
    })

    describe('allowedInOrganizations', () => {
        let userWithRoleAndPermissionInOrg1: User
        let userWithoutRole: User
        let userWithRoleWithoutPermission: User
        let inactiveUser: User
        let org1: Organization
        let org2: Organization
        let roleWithPermission: Role
        let roleWithoutPermission: Role
        let userPermissions: UserPermissions
        let token: TokenPayload

        beforeEach(async () => {
            userWithRoleAndPermissionInOrg1 = await createUser().save()
            userWithoutRole = await createUser().save()
            userWithRoleWithoutPermission = await createUser().save()
            inactiveUser = createUser()
            inactiveUser.status = Status.INACTIVE
            await inactiveUser.save()
            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            roleWithPermission = await createRoleFactory(
                'role_with_permission',
                org1,
                {
                    permissions: [PermissionName.delete_subjects_20447],
                }
            ).save()
            await createOrganizationMembership({
                user: userWithRoleAndPermissionInOrg1,
                organization: org1,
                roles: [roleWithPermission],
            }).save()
            await createOrganizationMembership({
                user: userWithRoleAndPermissionInOrg1,
                organization: org2,
                roles: [],
            }).save()
            await createOrganizationMembership({
                user: userWithoutRole,
                organization: org1,
            }).save()
            roleWithoutPermission = await createRoleFactory(
                'role_without_permission',
                org1,
                {
                    permissions: [],
                }
            ).save()
            await createOrganizationMembership({
                user: userWithRoleWithoutPermission,
                organization: org1,
                roles: [roleWithoutPermission],
            }).save()
        })

        context(
            'when the user has not the role with the included permission',
            () => {
                beforeEach(async () => {
                    req.headers = {
                        authorization: generateToken(
                            userToPayload(userWithRoleAndPermissionInOrg1)
                        ),
                    }
                    token = await checkToken(req)
                    userPermissions = new UserPermissions(token)
                })
                it('should return all the organizations ids that allow it and not the other', async () => {
                    const result = await userPermissions.organizationsWhereItIsAllowed(
                        [org1.organization_id, org2.organization_id],
                        PermissionName.delete_subjects_20447
                    )
                    expect(result).to.have.lengthOf(1)
                    expect(result[0]).to.equal(org1.organization_id)
                })
            }
        )

        context(
            'when the user has not the role with the included permission',
            () => {
                beforeEach(async () => {
                    req.headers = {
                        authorization: generateToken(
                            userToPayload(userWithoutRole)
                        ),
                    }
                    token = await checkToken(req)
                    userPermissions = new UserPermissions(token)
                })
                it('should return an empty array', async () => {
                    const result = await userPermissions.organizationsWhereItIsAllowed(
                        [org1.organization_id],
                        PermissionName.delete_subjects_20447
                    )
                    expect(result).to.be.have.lengthOf(0)
                })
            }
        )

        context(
            'when the user has a role that does not include the permission',
            () => {
                beforeEach(async () => {
                    req.headers = {
                        authorization: generateToken(
                            userToPayload(userWithRoleWithoutPermission)
                        ),
                    }
                    token = await checkToken(req)
                    userPermissions = new UserPermissions(token)
                })
                it('should return an empty array', async () => {
                    const result = await userPermissions.organizationsWhereItIsAllowed(
                        [org1.organization_id],
                        PermissionName.delete_subjects_20447
                    )
                    expect(result).to.be.have.lengthOf(0)
                })
            }
        )

        context('when the user is inactive', () => {
            beforeEach(async () => {
                req.headers = {
                    authorization: generateToken(userToPayload(inactiveUser)),
                }
                token = await checkToken(req)
                userPermissions = new UserPermissions(token)
            })
            it('should return an empty array', async () => {
                const result = await userPermissions.organizationsWhereItIsAllowed(
                    [org1.organization_id],
                    PermissionName.delete_subjects_20447
                )
                expect(result).to.be.have.lengthOf(0)
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
            const token = await checkToken(req)
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
})
