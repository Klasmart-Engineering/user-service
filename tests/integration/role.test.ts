import { expect } from 'chai'
import { Model } from '../../src/model'
import { createServer } from '../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import {
    addRoleToOrganizationMembership,
    removeRoleToOrganizationMembership,
} from '../utils/operations/organizationMembershipOps'
import {
    addUserToOrganizationAndValidate,
    createRole,
} from '../utils/operations/organizationOps'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../utils/operations/userOps'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import { PermissionName } from '../../src/permissions/permissionNames'
import {
    denyPermission,
    editPermissions,
    getPermissionViaRole,
    grantPermission,
    revokePermission,
    updateRole,
    deleteRole,
} from '../utils/operations/roleOps'
import { getNonAdminAuthToken, getAdminAuthToken } from '../utils/testConfig'
import { Permission } from '../../src/entities/permission'
import { Role } from '../../src/entities/role'
import { Status } from '../../src/entities/status'
import chaiAsPromised from 'chai-as-promised'
import chai from 'chai'
import { expectAPIError, expectAPIErrorCollection } from '../utils/apiError'
import _ from 'lodash'
import { User } from '../../src/entities/user'
import { Organization } from '../../src/entities/organization'
import {
    createAdminUser as createAdmin,
    createUser,
} from '../factories/user.factory'
import { createRole as createARole } from '../factories/role.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { DeleteRoleInput } from '../../src/types/graphQL/role'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { mutate } from '../../src/utils/mutations/commonStructure'
import { DeleteRoles } from '../../src/resolvers/role'
import { permErrorMeta } from '../utils/errors'
import {
    createDuplicateInputAPIError,
    createEntityAPIError,
} from '../../src/utils/resolvers'
import { APIError, APIErrorCollection } from '../../src/types/errors/apiError'
import { NIL_UUID } from '../utils/database'

chai.use(chaiAsPromised)

interface OrgData {
    org: Organization
    roles: Role[]
}

describe('role', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let originalAdmins: string[]

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('#set', () => {
        const originalRoleName = 'Original Role Name'
        const newRoleName = 'New Role Name'
        const roleDescription = 'Some description'
        let organizationId: string
        let userId: string
        let roleId: string

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            userId = (await createNonAdminUser(testClient)).user_id
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id,
                    'org 1'
                )
            ).organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                userId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when is a system role', () => {
            beforeEach(async () => {
                roleId = (
                    await createRole(
                        testClient,
                        organizationId,
                        originalRoleName
                    )
                ).role_id
                await updateRole(
                    testClient,
                    { roleId, systemRole: true },
                    { authorization: getAdminAuthToken() }
                )

                await addRoleToOrganizationMembership(
                    testClient,
                    userId,
                    organizationId,
                    roleId,
                    { authorization: getAdminAuthToken() }
                )
                await grantPermission(
                    testClient,
                    roleId,
                    PermissionName.edit_role_and_permissions_30332,
                    { authorization: getAdminAuthToken() }
                )
            })

            context('and the user is an admin', () => {
                it('updates the role', async () => {
                    const gqlRole = await updateRole(
                        testClient,
                        { roleId, roleName: newRoleName, roleDescription },
                        { authorization: getAdminAuthToken() }
                    )

                    const dbRole = await Role.findOneOrFail({
                        where: { role_id: roleId },
                    })
                    expect(gqlRole).to.exist
                    expect(gqlRole).to.include({
                        role_id: roleId,
                        role_name: newRoleName,
                        role_description: roleDescription,
                    })
                    expect(dbRole).to.include(gqlRole)
                })
            })

            context('and the user is not an admin', () => {
                it('raises a permission exception', async () => {
                    await expect(
                        updateRole(
                            testClient,
                            { roleId, newRoleName, roleDescription },
                            { authorization: getNonAdminAuthToken() }
                        )
                    ).to.be.rejected

                    const dbRole = await Role.findOneOrFail({
                        where: { role_id: roleId },
                    })
                    expect(dbRole.role_name).to.equal(originalRoleName)
                    expect(dbRole.system_role).to.be.true
                })
            })
        })

        context('when is not a system role', () => {
            beforeEach(async () => {
                roleId = (
                    await createRole(
                        testClient,
                        organizationId,
                        originalRoleName
                    )
                ).role_id
                await addRoleToOrganizationMembership(
                    testClient,
                    userId,
                    organizationId,
                    roleId,
                    { authorization: getAdminAuthToken() }
                )
            })

            context(
                "and the user has the 'edit groups' permission within the organization",
                () => {
                    beforeEach(async () => {
                        await grantPermission(
                            testClient,
                            roleId,
                            PermissionName.edit_role_and_permissions_30332,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('should return the modified role and update the database entry', async () => {
                        const gqlRole = await updateRole(
                            testClient,
                            { roleId, roleName: newRoleName, roleDescription },
                            { authorization: getNonAdminAuthToken() }
                        )

                        const dbRole = await Role.findOneOrFail({
                            where: { role_id: roleId },
                        })
                        expect(gqlRole).to.exist
                        expect(gqlRole).to.include({
                            role_id: roleId,
                            role_name: newRoleName,
                            role_description: roleDescription,
                        })
                        expect(dbRole).to.include(gqlRole)
                    })
                }
            )

            context(
                "and the user does not have the 'edit groups' permission within the organization",
                () => {
                    it('should throw a permission exception, and not update the database entry', async () => {
                        await expect(
                            updateRole(
                                testClient,
                                { roleId, newRoleName, roleDescription },
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbRole = await Role.findOneOrFail({
                            where: { role_id: roleId },
                        })
                        expect(dbRole.role_name).to.equal(originalRoleName)
                    })
                }
            )
        })
    })

    describe('#permission', () => {
        const nameOfPermissionToGet = PermissionName.create_school_20220
        let organizationId: string
        let userId: string
        let roleId: string

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            userId = (await createNonAdminUser(testClient)).user_id
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id,
                    'org 1'
                )
            ).organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                userId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            roleId = (await createRole(testClient, organizationId, 'My Role'))
                .role_id
            await addRoleToOrganizationMembership(
                testClient,
                userId,
                organizationId,
                roleId,
                { authorization: getAdminAuthToken() }
            )
            await grantPermission(testClient, roleId, nameOfPermissionToGet, {
                authorization: getAdminAuthToken(),
            })
        })

        context('when is a system role', () => {
            beforeEach(async () => {
                await updateRole(
                    testClient,
                    { roleId, systemRole: true },
                    { authorization: getAdminAuthToken() }
                )
            })

            context(
                "when user has the 'view role permissions' permission within the organization",
                () => {
                    beforeEach(async () => {
                        await grantPermission(
                            testClient,
                            roleId,
                            PermissionName.view_role_permissions_30112,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('should return the permission', async () => {
                        const gqlPermission = await getPermissionViaRole(
                            testClient,
                            roleId,
                            nameOfPermissionToGet,
                            { authorization: getNonAdminAuthToken() }
                        )

                        expect(gqlPermission).to.exist
                        expect(gqlPermission).to.include({
                            permission_name: nameOfPermissionToGet,
                        })
                    })
                }
            )

            context(
                "when user does not have the 'view role permissions' permission within the organization",
                () => {
                    it('should throw a permission exception', async () => {
                        await expect(
                            getPermissionViaRole(
                                testClient,
                                roleId,
                                nameOfPermissionToGet,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                    })
                }
            )
        })

        context('when is not a system role', () => {
            context(
                "when user has the 'view role permissions' permission within the organization",
                () => {
                    beforeEach(async () => {
                        await grantPermission(
                            testClient,
                            roleId,
                            PermissionName.view_role_permissions_30112,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('should return the permission', async () => {
                        const gqlPermission = await getPermissionViaRole(
                            testClient,
                            roleId,
                            nameOfPermissionToGet,
                            { authorization: getNonAdminAuthToken() }
                        )

                        expect(gqlPermission).to.exist
                        expect(gqlPermission).to.include({
                            permission_name: nameOfPermissionToGet,
                        })
                    })
                }
            )

            context(
                "when user does not have the 'view role permissions' permission within the organization",
                () => {
                    it('should throw a permission exception', async () => {
                        await expect(
                            getPermissionViaRole(
                                testClient,
                                roleId,
                                nameOfPermissionToGet,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                    })
                }
            )
        })
    })

    describe('#grant', () => {
        const roleInfo = (role: Role) => {
            return role.role_id
        }
        const nameOfPermissionToGrant =
            PermissionName.view_roles_and_permissions_30110
        let organizationId: string
        let userId: string
        let roleId: string

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            userId = (await createNonAdminUser(testClient)).user_id
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id,
                    'org 1'
                )
            ).organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                userId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            roleId = (await createRole(testClient, organizationId, 'My Role'))
                .role_id
            await addRoleToOrganizationMembership(
                testClient,
                userId,
                organizationId,
                roleId,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when is a system role', () => {
            beforeEach(async () => {
                await updateRole(
                    testClient,
                    { roleId, systemRole: true },
                    { authorization: getAdminAuthToken() }
                )
            })

            context('and the user is not an admin', () => {
                it('raises a permission exception', async () => {
                    await expect(
                        grantPermission(
                            testClient,
                            roleId,
                            nameOfPermissionToGrant,
                            { authorization: getNonAdminAuthToken() }
                        )
                    ).to.be.rejected

                    const dbPermission = await Permission.findOne({
                        where: { permission_name: nameOfPermissionToGrant },
                    })
                    const permRoles = (await dbPermission?.roles) || []
                    expect(permRoles.map(roleInfo)).to.not.deep.include(roleId)
                })
            })

            context('and the user is an admin', () => {
                context(
                    "when user has the 'edit role permissions' permission within the organization",
                    () => {
                        beforeEach(async () => {
                            await grantPermission(
                                testClient,
                                roleId,
                                PermissionName.edit_role_and_permissions_30332,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context(
                            'and permission entry exists with allow set to false',
                            () => {
                                beforeEach(async () => {
                                    await denyPermission(
                                        testClient,
                                        roleId,
                                        nameOfPermissionToGrant,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it("should return the permission with 'allow' set to true and update the database entry", async () => {
                                    const gqlPermission = await grantPermission(
                                        testClient,
                                        roleId,
                                        nameOfPermissionToGrant,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    const dbPermission = await Permission.findOneOrFail(
                                        {
                                            where: {
                                                permission_name: nameOfPermissionToGrant,
                                            },
                                        }
                                    )
                                    expect(gqlPermission).to.exist
                                    expect(gqlPermission).to.include({
                                        permission_name: nameOfPermissionToGrant,
                                        allow: true,
                                    })
                                    const permRoles =
                                        (await dbPermission?.roles) || []
                                    expect(
                                        permRoles.map(roleInfo)
                                    ).to.deep.include(roleId)

                                    expect(dbPermission).to.include(
                                        gqlPermission
                                    )
                                })
                            }
                        )

                        context('and permission entry does not exist', () => {
                            it("should return the permission with 'allow' set to true and create a database entry", async () => {
                                const gqlPermission = await grantPermission(
                                    testClient,
                                    roleId,
                                    nameOfPermissionToGrant,
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbPermission = await Permission.findOneOrFail(
                                    {
                                        where: {
                                            permission_name: nameOfPermissionToGrant,
                                        },
                                    }
                                )
                                expect(gqlPermission).to.exist
                                expect(gqlPermission).to.include({
                                    permission_name: nameOfPermissionToGrant,
                                    allow: true,
                                })
                                const permRoles =
                                    (await dbPermission?.roles) || []
                                expect(permRoles.map(roleInfo)).to.deep.include(
                                    roleId
                                )

                                expect(dbPermission).to.include(gqlPermission)
                            })
                        })
                    }
                )

                context(
                    "when user does not have the 'edit role permissions' permission within the organization",
                    () => {
                        context(
                            'and permission entry exists with allow set to false',
                            () => {
                                beforeEach(async () => {
                                    await denyPermission(
                                        testClient,
                                        roleId,
                                        nameOfPermissionToGrant,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('should create a database entry', async () => {
                                    await expect(
                                        grantPermission(
                                            testClient,
                                            roleId,
                                            nameOfPermissionToGrant,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )
                                    ).to.be.fulfilled

                                    const dbPermission = await Permission.findOneOrFail(
                                        {
                                            where: {
                                                permission_name: nameOfPermissionToGrant,
                                            },
                                        }
                                    )
                                    expect(dbPermission.allow).to.be.true
                                })
                            }
                        )

                        context('and permission entry does not exist', () => {
                            it('should create a database entry', async () => {
                                await expect(
                                    grantPermission(
                                        testClient,
                                        roleId,
                                        nameOfPermissionToGrant,
                                        { authorization: getAdminAuthToken() }
                                    )
                                ).to.be.fulfilled

                                const dbPermission = await Permission.findOne({
                                    where: {
                                        permission_name: nameOfPermissionToGrant,
                                    },
                                })
                                const permRoles =
                                    (await dbPermission?.roles) || []
                                expect(permRoles.map(roleInfo)).to.deep.include(
                                    roleId
                                )
                            })
                        })
                    }
                )
            })
        })

        context('when is not a system role', () => {
            context(
                "when user has the 'edit role permissions' permission within the organization",
                () => {
                    beforeEach(async () => {
                        await grantPermission(
                            testClient,
                            roleId,
                            PermissionName.edit_role_and_permissions_30332,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    context(
                        'and permission entry exists with allow set to false',
                        () => {
                            beforeEach(async () => {
                                await denyPermission(
                                    testClient,
                                    roleId,
                                    nameOfPermissionToGrant,
                                    { authorization: getAdminAuthToken() }
                                )
                            })

                            it("should return the permission with 'allow' set to true and update the database entry", async () => {
                                const gqlPermission = await grantPermission(
                                    testClient,
                                    roleId,
                                    nameOfPermissionToGrant,
                                    { authorization: getNonAdminAuthToken() }
                                )

                                const dbPermission = await Permission.findOneOrFail(
                                    {
                                        where: {
                                            permission_name: nameOfPermissionToGrant,
                                        },
                                    }
                                )
                                expect(gqlPermission).to.exist
                                expect(gqlPermission).to.include({
                                    permission_name: nameOfPermissionToGrant,
                                    allow: true,
                                })
                                const permRoles =
                                    (await dbPermission?.roles) || []
                                expect(permRoles.map(roleInfo)).to.deep.include(
                                    roleId
                                )

                                expect(dbPermission).to.include(gqlPermission)
                            })
                        }
                    )

                    context('and permission entry does not exist', () => {
                        it("should return the permission with 'allow' set to true and create a database entry", async () => {
                            const gqlPermission = await grantPermission(
                                testClient,
                                roleId,
                                nameOfPermissionToGrant,
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbPermission = await Permission.findOneOrFail(
                                {
                                    where: {
                                        permission_name: nameOfPermissionToGrant,
                                    },
                                }
                            )
                            expect(gqlPermission).to.exist
                            expect(gqlPermission).to.include({
                                permission_name: nameOfPermissionToGrant,
                                allow: true,
                            })
                            const permRoles = (await dbPermission?.roles) || []
                            expect(permRoles.map(roleInfo)).to.deep.include(
                                roleId
                            )

                            expect(dbPermission).to.include(gqlPermission)
                        })
                    })
                }
            )

            context(
                "when user does not have the 'edit role permissions' permission within the organization",
                () => {
                    context(
                        'and permission entry exists with allow set to false',
                        () => {
                            beforeEach(async () => {
                                await denyPermission(
                                    testClient,
                                    roleId,
                                    nameOfPermissionToGrant,
                                    { authorization: getAdminAuthToken() }
                                )
                            })

                            it('should throw a permission exception, and not create a database entry', async () => {
                                await expect(
                                    grantPermission(
                                        testClient,
                                        roleId,
                                        nameOfPermissionToGrant,
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbPermission = await Permission.findOneOrFail(
                                    {
                                        where: {
                                            permission_name: nameOfPermissionToGrant,
                                        },
                                    }
                                )
                                expect(dbPermission.allow).to.be.false
                            })
                        }
                    )

                    context('and permission entry does not exist', () => {
                        it('should throw a permission exception, and not create a database entry', async () => {
                            await expect(
                                grantPermission(
                                    testClient,
                                    roleId,
                                    nameOfPermissionToGrant,
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected

                            const dbPermission = await Permission.findOne({
                                where: {
                                    permission_name: nameOfPermissionToGrant,
                                },
                            })
                            const permRoles = (await dbPermission?.roles) || []
                            expect(permRoles.map(roleInfo)).to.not.deep.include(
                                roleId
                            )
                        })
                    })
                }
            )
        })
    })

    describe('#editPermissions', () => {
        const nameOfPermission = PermissionName.view_roles_and_permissions_30110
        let permission: Permission
        let organizationId: string
        let userId: string
        let roleId: string

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            userId = (await createNonAdminUser(testClient)).user_id
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id,
                    'org 1'
                )
            ).organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                userId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            roleId = (await createRole(testClient, organizationId, 'My Role'))
                .role_id
        })

        context('when is a system role', () => {
            beforeEach(async () => {
                await updateRole(
                    testClient,
                    { roleId, systemRole: true },
                    { authorization: getAdminAuthToken() }
                )
            })

            context('and the user is not an admin', () => {
                it('raises a permission exception', async () => {
                    await expect(
                        editPermissions(
                            testClient,
                            roleId,
                            [nameOfPermission],
                            { authorization: undefined }
                        )
                    ).to.be.rejected
                    const dbRole = await Role.findOneOrFail(roleId)
                    const dbPermissions = (await dbRole.permissions) || []
                    expect(dbPermissions).to.be.empty
                })
            })

            context('and the user is an admin', () => {
                context(
                    'and the user does not have edit roles permission',
                    () => {
                        beforeEach(async () => {
                            roleId = (
                                await createRole(
                                    testClient,
                                    organizationId,
                                    'My Role'
                                )
                            ).role_id
                            await addRoleToOrganizationMembership(
                                testClient,
                                userId,
                                organizationId,
                                roleId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('mutates the database entries', async () => {
                            await expect(
                                editPermissions(
                                    testClient,
                                    roleId,
                                    [nameOfPermission],
                                    { authorization: getAdminAuthToken() }
                                )
                            ).to.be.fulfilled
                            const dbRole = await Role.findOneOrFail(roleId)
                            const dbPermissions =
                                (await dbRole.permissions) || []
                            expect(dbPermissions).to.not.be.empty
                        })
                    }
                )

                context('and the user has all the permissions', () => {
                    const permissionInfo = (permission: Permission) => {
                        return permission.permission_name
                    }
                    const editRolePermission =
                        PermissionName.edit_role_and_permissions_30332

                    beforeEach(async () => {
                        roleId = (
                            await createRole(
                                testClient,
                                organizationId,
                                'My Role'
                            )
                        ).role_id
                        await addRoleToOrganizationMembership(
                            testClient,
                            userId,
                            organizationId,
                            roleId,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            roleId,
                            editRolePermission,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('edits permissions in role', async () => {
                        let gqlPermissions = await editPermissions(
                            testClient,
                            roleId,
                            [editRolePermission, nameOfPermission],
                            { authorization: getAdminAuthToken() }
                        )
                        expect(gqlPermissions.map(permissionInfo)).to.deep.eq([
                            editRolePermission,
                            nameOfPermission,
                        ])
                        let dbRole = await Role.findOneOrFail(roleId)
                        let dbPermissions = (await dbRole.permissions) || []
                        expect(
                            dbPermissions.map(permissionInfo)
                        ).to.deep.members([
                            editRolePermission,
                            nameOfPermission,
                        ])

                        gqlPermissions = await editPermissions(
                            testClient,
                            roleId,
                            [],
                            { authorization: getAdminAuthToken() }
                        )
                        expect(gqlPermissions).to.be.empty
                        dbRole = await Role.findOneOrFail(roleId)
                        dbPermissions = (await dbRole.permissions) || []
                        expect(dbPermissions).to.be.empty
                    })
                })
            })
        })

        context('when is not a system role', () => {
            context('when not authenticated', () => {
                beforeEach(async () => {
                    await addRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        roleId,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('throws a permission exception and not mutate the database entries', async () => {
                    await expect(
                        editPermissions(
                            testClient,
                            roleId,
                            [nameOfPermission],
                            { authorization: undefined }
                        )
                    ).to.be.rejected
                    const dbRole = await Role.findOneOrFail(roleId)
                    const dbPermissions = (await dbRole.permissions) || []
                    expect(dbPermissions).to.be.empty
                })
            })

            context('when authenticated', () => {
                context(
                    'and the user does not have edit roles permission',
                    () => {
                        beforeEach(async () => {
                            roleId = (
                                await createRole(
                                    testClient,
                                    organizationId,
                                    'My Role'
                                )
                            ).role_id
                            await addRoleToOrganizationMembership(
                                testClient,
                                userId,
                                organizationId,
                                roleId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('throws a permission exception and not mutate the database entries', async () => {
                            await expect(
                                editPermissions(
                                    testClient,
                                    roleId,
                                    [nameOfPermission],
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected
                            const dbRole = await Role.findOneOrFail(roleId)
                            const dbPermissions =
                                (await dbRole.permissions) || []
                            expect(dbPermissions).to.be.empty
                        })
                    }
                )

                context('and the user has all the permissions', () => {
                    const permissionInfo = (permission: Permission) => {
                        return permission.permission_name
                    }
                    const editRolePermission =
                        PermissionName.edit_role_and_permissions_30332

                    beforeEach(async () => {
                        roleId = (
                            await createRole(
                                testClient,
                                organizationId,
                                'My Role'
                            )
                        ).role_id
                        await addRoleToOrganizationMembership(
                            testClient,
                            userId,
                            organizationId,
                            roleId,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            roleId,
                            editRolePermission,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('edits permissions in role', async () => {
                        let gqlPermissions = await editPermissions(
                            testClient,
                            roleId,
                            [editRolePermission, nameOfPermission],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlPermissions.map(permissionInfo)).to.deep.eq([
                            editRolePermission,
                            nameOfPermission,
                        ])
                        let dbRole = await Role.findOneOrFail(roleId)
                        let dbPermissions = (await dbRole.permissions) || []
                        expect(
                            dbPermissions.map(permissionInfo)
                        ).to.deep.members([
                            editRolePermission,
                            nameOfPermission,
                        ])

                        gqlPermissions = await editPermissions(
                            testClient,
                            roleId,
                            [],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlPermissions).to.be.empty
                        dbRole = await Role.findOneOrFail(roleId)
                        dbPermissions = (await dbRole.permissions) || []
                        expect(dbPermissions).to.be.empty
                    })
                })
            })
        })
    })

    describe('#revoke', () => {
        const roleInfo = (role: Role) => {
            return role.role_id
        }
        const nameOfPermissionToRevoke =
            PermissionName.view_role_permissions_30112
        let organizationId: string
        let userId: string
        let roleId: string

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            userId = (await createNonAdminUser(testClient)).user_id
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id,
                    'org 1'
                )
            ).organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                userId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            roleId = (await createRole(testClient, organizationId, 'My Role'))
                .role_id
            await addRoleToOrganizationMembership(
                testClient,
                userId,
                organizationId,
                roleId,
                { authorization: getAdminAuthToken() }
            )
            await grantPermission(
                testClient,
                roleId,
                nameOfPermissionToRevoke,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when is a system role', () => {
            beforeEach(async () => {
                await updateRole(
                    testClient,
                    { roleId, systemRole: true },
                    { authorization: getAdminAuthToken() }
                )
            })

            context('and the user is not an admin', () => {
                it('raises a permission exception', async () => {
                    await expect(
                        denyPermission(
                            testClient,
                            roleId,
                            nameOfPermissionToRevoke,
                            { authorization: getNonAdminAuthToken() }
                        )
                    ).to.be.rejected

                    const dbPermission = await Permission.findOneOrFail({
                        where: { permission_name: nameOfPermissionToRevoke },
                    })
                    expect(dbPermission.allow).to.be.true
                })
            })

            context('and the user is an admin', () => {
                context(
                    "when user has the 'edit role permissions' permission within the organization",
                    () => {
                        beforeEach(async () => {
                            await grantPermission(
                                testClient,
                                roleId,
                                PermissionName.edit_role_and_permissions_30332,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('should return true and delete the database entry', async () => {
                            await expect(
                                revokePermission(
                                    testClient,
                                    roleId,
                                    nameOfPermissionToRevoke,
                                    { authorization: getAdminAuthToken() }
                                )
                            ).to.be.fulfilled

                            const dbPermission = await Permission.findOne({
                                where: {
                                    permission_name: nameOfPermissionToRevoke,
                                },
                            })
                            const permRoles = (await dbPermission?.roles) || []
                            expect(permRoles.map(roleInfo)).to.not.deep.include(
                                roleId
                            )
                        })
                    }
                )

                context(
                    "when user does not have the 'edit role permissions' permission within the organization",
                    () => {
                        it('should delete/modify the database entry', async () => {
                            await expect(
                                denyPermission(
                                    testClient,
                                    roleId,
                                    nameOfPermissionToRevoke,
                                    { authorization: getAdminAuthToken() }
                                )
                            ).to.be.fulfilled

                            const dbPermission = await Permission.findOneOrFail(
                                {
                                    where: {
                                        permission_name: nameOfPermissionToRevoke,
                                    },
                                }
                            )
                            expect(dbPermission.allow).to.be.false
                        })
                    }
                )
            })
        })

        context('when is not a system role', () => {
            context(
                "when user has the 'edit role permissions' permission within the organization",
                () => {
                    beforeEach(async () => {
                        await grantPermission(
                            testClient,
                            roleId,
                            PermissionName.edit_role_and_permissions_30332,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('should return true and delete the database entry', async () => {
                        await expect(
                            revokePermission(
                                testClient,
                                roleId,
                                nameOfPermissionToRevoke,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.fulfilled

                        const dbPermission = await Permission.findOne({
                            where: {
                                permission_name: nameOfPermissionToRevoke,
                            },
                        })
                        const permRoles = (await dbPermission?.roles) || []
                        expect(permRoles.map(roleInfo)).to.not.include(roleId)
                    })
                }
            )

            context(
                "when user does not have the 'edit role permissions' permission within the organization",
                () => {
                    it('should throw a permission exception and not delete/modify the database entry', async () => {
                        await expect(
                            denyPermission(
                                testClient,
                                roleId,
                                nameOfPermissionToRevoke,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbPermission = await Permission.findOneOrFail({
                            where: {
                                permission_name: nameOfPermissionToRevoke,
                            },
                        })
                        expect(dbPermission.allow).to.be.true
                    })
                }
            )
        })
    })

    describe('#delete_role', () => {
        let organizationId: string
        let userId: string
        let roleId: string
        let roleToDeleteId: string

        function delRole(token: string | undefined) {
            return deleteRole(testClient, roleToDeleteId, {
                authorization: token,
            })
        }

        async function checkRoleRemoved(isRemoved: boolean) {
            const dbRole = await Role.findOneOrFail(roleToDeleteId)
            if (isRemoved) {
                expect(dbRole.status).to.eq(Status.INACTIVE)
                expect(dbRole.deleted_at).to.not.be.null
            } else {
                expect(dbRole.status).to.eq(Status.ACTIVE)
                expect(dbRole.deleted_at).to.be.null
            }
        }

        async function deleteSucceeds(token: string) {
            const gqlDeleteRole = await expect(delRole(token)).to.be.fulfilled
            expect(gqlDeleteRole).to.be.true
            await checkRoleRemoved(true)
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            userId = (await createNonAdminUser(testClient)).user_id
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id,
                    'org 1'
                )
            ).organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                userId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            roleId = (await createRole(testClient, organizationId, 'My Role'))
                .role_id
            await addRoleToOrganizationMembership(
                testClient,
                userId,
                organizationId,
                roleId,
                { authorization: getAdminAuthToken() }
            )

            roleToDeleteId = (
                await createRole(testClient, organizationId, 'Role To Delete')
            ).role_id
            await addRoleToOrganizationMembership(
                testClient,
                userId,
                organizationId,
                roleToDeleteId,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when the user has delete role permissions', () => {
            beforeEach(async () => {
                await grantPermission(
                    testClient,
                    roleId,
                    PermissionName.delete_role_30440,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('fails to delete the role with a role-in-use error', async () => {
                expectAPIError.delete_rejected_entity_in_use(
                    await expect(delRole(getNonAdminAuthToken())).to.be
                        .rejected,
                    {
                        entity: 'Role',
                        entityName: roleToDeleteId,
                    },
                    ['role_id']
                )
                await checkRoleRemoved(false)
            })

            context('and the role is not being used', () => {
                beforeEach(async () => {
                    await removeRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        roleToDeleteId,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('deletes the role', async () => {
                    await deleteSucceeds(getNonAdminAuthToken())
                })

                context('but the role is a system role', () => {
                    beforeEach(async () => {
                        await updateRole(
                            testClient,
                            { roleId: roleToDeleteId, systemRole: true },
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('fails to delete the role with a permission error', async () => {
                        await expect(
                            delRole(getNonAdminAuthToken())
                        ).to.be.rejectedWith(
                            `User(${userId}) does not have Admin permissions`
                        )
                        await checkRoleRemoved(false)
                    })

                    context('however the user is an admin', () => {
                        it('deletes the role', async () => {
                            await deleteSucceeds(getAdminAuthToken())
                        })
                    })
                })

                context('but the role is already inactive', () => {
                    beforeEach(async () => {
                        await delRole(getAdminAuthToken())
                    })
                    it('fails to delete the role with an inactive-status error', async () => {
                        expectAPIError.inactive_status(
                            await expect(delRole(getNonAdminAuthToken())).to.be
                                .rejected,
                            {
                                entity: 'Role',
                                entityName: roleToDeleteId,
                            },
                            ['role_id']
                        )
                        await checkRoleRemoved(true)
                    })
                })
            })
        })

        context('when the user does not have delete role permissions', () => {
            it('fails to delete the role with a permission error', async () => {
                await expect(
                    delRole(getNonAdminAuthToken())
                ).to.be.rejectedWith(
                    `User(${userId}) does not have Permission(${PermissionName.delete_role_30440}) in Organizations(${organizationId})`
                )
                await checkRoleRemoved(false)
            })
        })
    })

    describe('deleteRoles', () => {
        let admin: User
        let memberWithPermission: User
        let memberWithoutPermission: User
        let nonMember: User
        let orgsData: OrgData[]
        let systemRoles: Role[]
        let rolesTotalCount: number
        const orgsCount = 2
        const rolesCount = 5

        const deleteRolesFromResolver = async (
            caller: User,
            input: DeleteRoleInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(caller))
            return mutate(DeleteRoles, { input }, permissions)
        }

        const buildInputArray = (roles: Role[]) =>
            Array.from(roles, (r) => {
                return {
                    id: r.role_id,
                }
            })

        const expectRolesDeleted = async (
            caller: User,
            rolesToDelete: Role[]
        ) => {
            const input = buildInputArray(rolesToDelete)
            const { roles } = await deleteRolesFromResolver(caller, input)

            expect(roles).to.have.lengthOf(input.length)
            roles.forEach((r, i) => {
                expect(r.id).to.eq(input[i].id)
                expect(r.status).to.eq(Status.INACTIVE)
            })

            const rolesDB = await Role.findByIds(input.map((i) => i.id))

            expect(rolesDB).to.have.lengthOf(input.length)
            rolesDB.forEach((rdb) => {
                const inputRelated = input.find((i) => i.id === rdb.role_id)
                expect(inputRelated).to.exist
                expect(rdb.role_id).to.eq(inputRelated?.id)
                expect(rdb.status).to.eq(Status.INACTIVE)
            })
        }

        const expectRoles = async (quantity: number) => {
            const roleCount = await Role.count({
                where: { status: Status.ACTIVE },
            })

            expect(roleCount).to.eq(quantity)
        }

        const expectPermissionError = async (
            caller: User,
            rolesToDelete: Role[]
        ) => {
            const permError = permErrorMeta(PermissionName.delete_role_30440)
            const input = buildInputArray(rolesToDelete)
            const operation = deleteRolesFromResolver(caller, input)

            await expect(operation).to.be.rejectedWith(permError(caller))
        }

        const expectInputErrors = async (
            input: DeleteRoleInput[],
            expectedErrors: APIError[],
            finalCount: number
        ) => {
            const operation = deleteRolesFromResolver(admin, input)

            await expectAPIErrorCollection(
                operation,
                new APIErrorCollection(expectedErrors)
            )

            await expectRoles(finalCount)
        }

        const expectDBCalls = async (
            rolesToDelete: Role[],
            caller: User,
            expectedCalls: number,
            message: string
        ) => {
            const input = buildInputArray(rolesToDelete)
            connection.logger.reset()
            await deleteRolesFromResolver(caller, input)
            const callsToDB = connection.logger.count

            expect(callsToDB).to.eq(expectedCalls, message)
        }

        beforeEach(async () => {
            orgsData = []
            admin = await createAdmin().save()
            systemRoles = await Role.find({ take: rolesCount })

            const roleForDeleteRoles = createARole('Delete Roles', undefined, {
                permissions: [PermissionName.delete_role_30440],
            })

            roleForDeleteRoles.system_role = true
            await roleForDeleteRoles.save()

            for (let i = 0; i < orgsCount; i += 1) {
                const org = await createOrganization().save()
                const roles = await Role.save(
                    Array.from(new Array(rolesCount), (_, i) =>
                        createARole(`Role ${i}`, org)
                    )
                )

                orgsData.push({ org, roles })
            }

            memberWithPermission = await createUser().save()
            memberWithoutPermission = await createUser().save()
            nonMember = await createUser().save()

            await createOrganizationMembership({
                user: memberWithPermission,
                organization: orgsData[0].org,
                roles: [roleForDeleteRoles],
            }).save()

            await createOrganizationMembership({
                user: memberWithoutPermission,
                organization: orgsData[0].org,
            }).save()

            rolesTotalCount = await Role.count()
        })

        context('permissions', () => {
            context('successful cases', () => {
                context('when caller is admin', () => {
                    it('should delete any roles', async () => {
                        const rolesToDelete = orgsData
                            .map((d) => d.roles)
                            .flat()

                        await expectRolesDeleted(admin, rolesToDelete)
                        await expectRoles(
                            rolesTotalCount - rolesToDelete.length
                        )
                    })
                })

                context('when caller is not admin', () => {
                    context('but has permission', () => {
                        it('should delete roles from the organization which belongs', async () => {
                            const rolesToDelete = orgsData[0].roles

                            await expectRolesDeleted(
                                memberWithPermission,
                                rolesToDelete
                            )

                            await expectRoles(
                                rolesTotalCount - rolesToDelete.length
                            )
                        })
                    })
                })
            })

            context('error handling', () => {
                context('when caller is not admin', () => {
                    context('but has permission', () => {
                        context(
                            'and tries to delete roles from an organization which does not belongs',
                            () => {
                                it('should throw a permission error', async () => {
                                    const caller = memberWithPermission
                                    const rolesToDelete = orgsData[1].roles
                                    await expectPermissionError(
                                        caller,
                                        rolesToDelete
                                    )
                                })
                            }
                        )
                    })

                    context('has not permission', () => {
                        context('but has membership', () => {
                            context(
                                'and tries to delete roles from the organization which belongs',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const caller = memberWithoutPermission
                                        const rolesToDelete = orgsData[0].roles
                                        await expectPermissionError(
                                            caller,
                                            rolesToDelete
                                        )
                                    })
                                }
                            )
                        })

                        context('has not membership', () => {
                            context('and tries to delete any role', () => {
                                it('should throw a permission error', async () => {
                                    const caller = nonMember
                                    const rolesToDelete = orgsData
                                        .map((d) => d.roles)
                                        .flat()

                                    await expectPermissionError(
                                        caller,
                                        rolesToDelete
                                    )
                                })
                            })
                        })
                    })
                })
            })
        })

        context('input', () => {
            context('error handling', () => {
                context(
                    "a role with the given input 'id' field does not exist",
                    () => {
                        it('should throw an ErrorCollection', async () => {
                            const nonExistentId = NIL_UUID
                            const rolesToDelete = orgsData[0].roles
                            const input = buildInputArray(rolesToDelete)
                            input.push({ id: nonExistentId })
                            const expectedErrors = [
                                createEntityAPIError(
                                    'nonExistent',
                                    input.length - 1,
                                    'Role',
                                    nonExistentId
                                ),
                            ]

                            await expectInputErrors(
                                input,
                                expectedErrors,
                                rolesTotalCount
                            )
                        })
                    }
                )
            })
        })

        context('DB Calls', () => {
            context('when caller is admin', () => {
                context('when roles belong to the same organization', () => {
                    it('should do 3 DB calls', async () => {
                        const rolesToDelete = orgsData[0].roles
                        await expectDBCalls(
                            rolesToDelete,
                            admin,
                            3,
                            '1 for get roles; 1 for get caller user; and 1 for save changes'
                        )
                    })
                })

                context(
                    'when roles belong to more than one organization or are system',
                    () => {
                        it('should do 3 DB calls', async () => {
                            const rolesToDelete = [
                                ...systemRoles,
                                ...orgsData.map((d) => d.roles).flat(),
                            ]

                            await expectDBCalls(
                                rolesToDelete,
                                admin,
                                3,
                                '1 for get roles; 1 for get caller user; and 1 for save changes'
                            )
                        })
                    }
                )
            })

            context('when caller is not admin', () => {
                it('should do 4 DB calls', async () => {
                    const rolesToDelete = orgsData[0].roles
                    await expectDBCalls(
                        rolesToDelete,
                        memberWithPermission,
                        4,
                        '1 for get roles; 1 for get caller user; 1 for check permissions; and 1 for save changes'
                    )
                })
            })
        })
    })
})
