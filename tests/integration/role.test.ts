import { expect } from 'chai'
import { Connection } from 'typeorm'
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
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createTestConnection } from '../utils/testConnection'
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
import { expectAPIError } from '../utils/apiError'
import _ from 'lodash'
chai.use(chaiAsPromised)

describe('role', () => {
    let connection: Connection
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
})
