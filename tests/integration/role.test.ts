import { expect } from 'chai'
import { In, getConnection, getManager } from 'typeorm'
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
import { TestConnection } from '../utils/testConnection'
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
import {
    getNonAdminAuthToken,
    getAdminAuthToken,
    generateToken,
} from '../utils/testConfig'
import { Permission } from '../../src/entities/permission'
import { Role } from '../../src/entities/role'
import { Status } from '../../src/entities/status'
import chaiAsPromised from 'chai-as-promised'
import chai from 'chai'
import { expectAPIError, expectAPIErrorCollection } from '../utils/apiError'
import { Organization } from '../../src/entities/organization'
import { User } from '../../src/entities/user'
import {
    CreateRoleInput,
    UpdateRoleInput,
    DeleteRoleInput,
} from '../../src/types/graphQL/role'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { mutate } from '../../src/utils/resolvers/commonStructure'
import { CreateRoles, UpdateRoles, DeleteRoles } from '../../src/resolvers/role'
import { permErrorMeta } from '../utils/errors'
import { APIError, APIErrorCollection } from '../../src/types/errors/apiError'
import {
    createAdminUser as createAdmin,
    createUser,
} from '../factories/user.factory'
import { createRole as createARole } from '../factories/role.factory'
import { createOrganization } from '../factories/organization.factory'
import { NIL_UUID } from '../utils/database'
import {
    createEntityAPIError,
    createDuplicateAttributeAPIError,
    createInputRequiresAtLeastOne,
    createNonExistentOrInactiveEntityAPIError,
} from '../../src/utils/resolvers/errors'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { runQuery } from '../utils/operations/modelOps'
import { organizationAdminRole } from '../../src/permissions/organizationAdmin'
import { superAdminRole } from '../../src/permissions/superAdmin'

chai.use(chaiAsPromised)

interface OrgData {
    org: Organization
    roles: Role[]
}

type RoleAndPermissions = Role & { __permissions__?: Permission[] }

describe('role', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
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

                    const dbRole = await Role.findOneByOrFail({
                        role_id: roleId,
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

                    const dbRole = await Role.findOneByOrFail({
                        role_id: roleId,
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

                        const dbRole = await Role.findOneByOrFail({
                            role_id: roleId,
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

                        const dbRole = await Role.findOneByOrFail({
                            role_id: roleId,
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

                    const dbPermission = await Permission.findOneBy({
                        permission_name: nameOfPermissionToGrant,
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

                                    const dbPermission = await Permission.findOneByOrFail(
                                        {
                                            permission_name: nameOfPermissionToGrant,
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

                                const dbPermission = await Permission.findOneByOrFail(
                                    {
                                        permission_name: nameOfPermissionToGrant,
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

                                    const dbPermission = await Permission.findOneByOrFail(
                                        {
                                            permission_name: nameOfPermissionToGrant,
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

                                const dbPermission = await Permission.findOneBy(
                                    {
                                        permission_name: nameOfPermissionToGrant,
                                    }
                                )
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

                                const dbPermission = await Permission.findOneByOrFail(
                                    {
                                        permission_name: nameOfPermissionToGrant,
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

                            const dbPermission = await Permission.findOneByOrFail(
                                {
                                    permission_name: nameOfPermissionToGrant,
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

                                const dbPermission = await Permission.findOneByOrFail(
                                    {
                                        permission_name: nameOfPermissionToGrant,
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

                            const dbPermission = await Permission.findOneBy({
                                permission_name: nameOfPermissionToGrant,
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
                    const dbRole = await Role.findOneByOrFail({
                        role_id: roleId,
                    })
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
                            const dbRole = await Role.findOneByOrFail({
                                role_id: roleId,
                            })
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
                        expect(
                            gqlPermissions.map(permissionInfo)
                        ).to.deep.equalInAnyOrder([
                            editRolePermission,
                            nameOfPermission,
                        ])
                        let dbRole = await Role.findOneByOrFail({
                            role_id: roleId,
                        })
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
                        dbRole = await Role.findOneByOrFail({
                            role_id: roleId,
                        })
                        dbPermissions = (await dbRole.permissions) || []
                        expect(dbPermissions).to.be.empty
                    })

                    context(
                        'when attempting to add a superAdmin-only permission',
                        () => {
                            let superAdminPermission: Permission
                            beforeEach(async () => {
                                superAdminPermission = await Permission.findOneByOrFail(
                                    {
                                        permission_level:
                                            superAdminRole.role_name,
                                    }
                                )
                            })

                            it('fails to add a superAdmin-only permission', async () => {
                                await expect(
                                    editPermissions(
                                        testClient,
                                        roleId,
                                        [
                                            editRolePermission,
                                            nameOfPermission,
                                            superAdminPermission.permission_name,
                                        ],
                                        { authorization: getAdminAuthToken() }
                                    )
                                ).to.be.rejectedWith(
                                    `Permission ${superAdminPermission.permission_name} not found`
                                )
                            })
                        }
                    )
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
                    const dbRole = await Role.findOneByOrFail({
                        role_id: roleId,
                    })
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
                            const dbRole = await Role.findOneByOrFail({
                                role_id: roleId,
                            })
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
                        expect(
                            gqlPermissions.map(permissionInfo)
                        ).to.deep.equalInAnyOrder([
                            editRolePermission,
                            nameOfPermission,
                        ])
                        let dbRole = await Role.findOneByOrFail({
                            role_id: roleId,
                        })
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
                        dbRole = await Role.findOneByOrFail({
                            role_id: roleId,
                        })
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

                    const dbPermission = await Permission.findOneByOrFail({
                        permission_name: nameOfPermissionToRevoke,
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

                            const dbPermission = await Permission.findOneBy({
                                permission_name: nameOfPermissionToRevoke,
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

                            const dbPermission = await Permission.findOneByOrFail(
                                {
                                    permission_name: nameOfPermissionToRevoke,
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

                        const dbPermission = await Permission.findOneBy({
                            permission_name: nameOfPermissionToRevoke,
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

                        const dbPermission = await Permission.findOneByOrFail({
                            permission_name: nameOfPermissionToRevoke,
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
            const dbRole = await Role.findOneByOrFail({
                role_id: roleToDeleteId,
            })
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

    describe('top-level mutations', () => {
        let admin: User
        let memberWithPermission: User
        let memberWithoutPermission: User
        let nonMember: User
        const orgsCount = 2
        const rolesCount = 5

        const expectRoles = async (quantity: number) => {
            const roleCount = await Role.countBy({
                status: Status.ACTIVE,
                system_role: false,
            })

            expect(roleCount).to.eq(quantity)
        }

        const createOrgsData = async () => {
            const orgsData = []

            for (let i = 0; i < orgsCount; i += 1) {
                const org = await createOrganization().save()
                const roles = await Role.save(
                    Array.from(new Array(rolesCount), (_, i) =>
                        createARole(`Role ${i}`, org)
                    )
                )

                orgsData.push({ org, roles })
            }

            return orgsData
        }

        const createPermissionMemberships = async (
            org: Organization,
            role: Role
        ) => {
            await createOrganizationMembership({
                user: memberWithPermission,
                organization: org,
                roles: [role],
            }).save()

            await createOrganizationMembership({
                user: memberWithoutPermission,
                organization: org,
            }).save()
        }

        beforeEach(async () => {
            admin = await createAdmin().save()
            memberWithPermission = await createUser().save()
            memberWithoutPermission = await createUser().save()
            nonMember = await createUser().save()
        })

        describe('createRoles', () => {
            let orgs: Organization[]

            const createRolesFromResolver = async (
                caller: User,
                input: CreateRoleInput[]
            ) => {
                const permissions = new UserPermissions(userToPayload(caller))
                return mutate(CreateRoles, { input }, permissions)
            }

            const expectCreateRoles = async (
                caller: User,
                input: CreateRoleInput[]
            ) => {
                const { roles } = await createRolesFromResolver(caller, input)

                expect(roles).to.have.lengthOf(input.length)
                roles.forEach((r, i) => {
                    expect(r.name).to.equal(input[i].roleName)
                    expect(r.description).to.equal(input[i].roleDescription)
                })

                const DBRoles = await Role.findBy({
                    role_id: In(roles.map((r) => r.id)),
                })

                expect(DBRoles).to.have.lengthOf(input.length)
                DBRoles.forEach(async (dbr) => {
                    const relatedRole = roles.find((r) => r.id === dbr.role_id)
                    const index = roles.indexOf(relatedRole!)

                    expect(dbr.role_name).to.equal(relatedRole?.name)
                    expect(dbr.role_description).to.equal(
                        relatedRole?.description
                    )

                    const org = await dbr.organization

                    expect(org?.organization_id).to.equal(
                        input[index].organizationId
                    )
                })
            }

            const buildDefaultInputArray = (
                organizations: Organization[]
            ): CreateRoleInput[] =>
                Array.from(organizations, (o, i) =>
                    Array.from(new Array(rolesCount), (_, j) => {
                        return {
                            organizationId: o.organization_id,
                            roleName: `Role ${j}`,
                            roleDescription: `Role number ${j} for org number ${i}`,
                        }
                    })
                ).flat()

            const expectPermissionError = async (
                caller: User,
                input: CreateRoleInput[]
            ) => {
                const permError = permErrorMeta(
                    PermissionName.create_role_with_permissions_30222
                )

                const operation = createRolesFromResolver(caller, input)
                await expect(operation).to.be.rejectedWith(permError(caller))
                await expectRoles(0)
            }

            const expectInputErrors = async (
                input: CreateRoleInput[],
                expectedErrors: APIError[],
                finalCount: number
            ) => {
                const operation = createRolesFromResolver(admin, input)
                await expectAPIErrorCollection(
                    operation,
                    new APIErrorCollection(expectedErrors)
                )

                await expectRoles(finalCount)
            }

            beforeEach(async () => {
                const roleForCreate = await createARole(
                    'Create Roles',
                    undefined,
                    {
                        permissions: [
                            PermissionName.create_role_with_permissions_30222,
                        ],
                    },
                    true
                ).save()

                orgs = await Organization.save(
                    Array.from(new Array(orgsCount), () => createOrganization())
                )

                await createPermissionMemberships(orgs[0], roleForCreate)
            })

            context('permissions', () => {
                context('successful cases', () => {
                    context('when caller is admin', () => {
                        it('should create roles in any organization', async () => {
                            const input = buildDefaultInputArray(orgs)
                            await expectCreateRoles(admin, input)
                        })
                    })

                    context('when caller is not admin', () => {
                        context('but has permissions', () => {
                            it('should create roles just in the organization which belongs', async () => {
                                const input = buildDefaultInputArray([orgs[0]])
                                await expectCreateRoles(
                                    memberWithPermission,
                                    input
                                )
                            })
                        })
                    })
                })

                context('error handling', () => {
                    context('when caller is not admin', () => {
                        context('but has permissions', () => {
                            context(
                                'and tries to create roles in an organization which does not belong',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const input = buildDefaultInputArray([
                                            orgs[1],
                                        ])

                                        await expectPermissionError(
                                            memberWithPermission,
                                            input
                                        )
                                    })
                                }
                            )
                        })

                        context('and has not permission', () => {
                            context('but has membership', () => {
                                context(
                                    'and tries to create roles in the organization which belongs',
                                    () => {
                                        it('should throw a permission error', async () => {
                                            const input = buildDefaultInputArray(
                                                [orgs[0]]
                                            )

                                            await expectPermissionError(
                                                memberWithoutPermission,
                                                input
                                            )
                                        })
                                    }
                                )
                            })

                            context('also has not membership', () => {
                                context(
                                    'and tries to create roles in any organization',
                                    () => {
                                        it('should throw a permission error', async () => {
                                            const input = buildDefaultInputArray(
                                                orgs
                                            )

                                            await expectPermissionError(
                                                nonMember,
                                                input
                                            )
                                        })
                                    }
                                )
                            })
                        })
                    })
                })
            })

            context('input', () => {
                context('successful cases', () => {
                    context(
                        'when roleName already exists in a system role',
                        () => {
                            let systemRoles: Role[]

                            beforeEach(async () => {
                                systemRoles = await Role.findBy({
                                    system_role: true,
                                })
                            })

                            it('should create the roles', async () => {
                                let input = buildDefaultInputArray([orgs[0]])
                                input = input.map((i, index) => {
                                    return {
                                        organizationId: i.organizationId,
                                        roleName: systemRoles[index].role_name!,
                                        roleDescription: i.roleDescription,
                                    }
                                })

                                await expectCreateRoles(admin, input)
                            })
                        }
                    )

                    context(
                        'when roleName already exists in another organization',
                        () => {
                            let existentRoles: Role[]

                            beforeEach(async () => {
                                existentRoles = await Role.save(
                                    Array.from(new Array(rolesCount), () =>
                                        createARole(undefined, orgs[1])
                                    )
                                )
                            })

                            it('should create the roles', async () => {
                                let input = buildDefaultInputArray([orgs[0]])
                                input = input.map((i, index) => {
                                    return {
                                        organizationId: i.organizationId,
                                        roleName: existentRoles[index]
                                            .role_name!,
                                        roleDescription: i.roleDescription,
                                    }
                                })

                                await expectCreateRoles(admin, input)
                            })
                        }
                    )

                    context(
                        'when roleName already exists the organization',
                        () => {
                            context('but that role is inactive', () => {
                                let inactiveRoles: Role[]

                                beforeEach(async () => {
                                    inactiveRoles = await Role.save(
                                        Array.from(
                                            new Array(rolesCount),
                                            () => {
                                                const role = createARole(
                                                    undefined,
                                                    orgs[0]
                                                )
                                                role.status = Status.INACTIVE
                                                return role
                                            }
                                        )
                                    )
                                })

                                it('should create the roles', async () => {
                                    let input = buildDefaultInputArray([
                                        orgs[0],
                                    ])
                                    input = input.map((i, index) => {
                                        return {
                                            organizationId: i.organizationId,
                                            roleName: inactiveRoles[index]
                                                .role_name!,
                                            roleDescription: i.roleDescription,
                                        }
                                    })

                                    await expectCreateRoles(admin, input)
                                })
                            })
                        }
                    )
                })

                context('error handling', () => {
                    context(
                        'when organizationId does not belong to any organization',
                        () => {
                            it('should throw an ErrorCollection', async () => {
                                const index = 0
                                const inexistentId = NIL_UUID
                                const input = buildDefaultInputArray([orgs[0]])
                                input[index].organizationId = inexistentId

                                const expectedErrors = [
                                    createNonExistentOrInactiveEntityAPIError(
                                        index,
                                        ['organization_id'],
                                        'ID',
                                        'Organization',
                                        inexistentId
                                    ),
                                ]

                                await expectInputErrors(
                                    input,
                                    expectedErrors,
                                    0
                                )
                            })
                        }
                    )

                    context(
                        'when organizationId belongs to an inactive organization',
                        () => {
                            let inactiveOrg: Organization

                            beforeEach(async () => {
                                inactiveOrg = orgs[0]
                                await inactiveOrg.inactivate(getManager())
                            })

                            it('should throw an ErrorCollection', async () => {
                                const input = buildDefaultInputArray([
                                    inactiveOrg,
                                ])
                                const expectedErrors = Array.from(
                                    input,
                                    (_, i) =>
                                        createNonExistentOrInactiveEntityAPIError(
                                            i,
                                            ['organization_id'],
                                            'ID',
                                            'Organization',
                                            inactiveOrg.organization_id
                                        )
                                )

                                await expectInputErrors(
                                    input,
                                    expectedErrors,
                                    0
                                )
                            })
                        }
                    )

                    context('when roleName is duplicated', () => {
                        let org: Organization
                        let existentRole: Role

                        beforeEach(async () => {
                            org = orgs[0]
                            existentRole = await createARole(
                                undefined,
                                orgs[0]
                            ).save()
                        })

                        it('should throw an ErrorCollection', async () => {
                            const index = 0
                            const input = buildDefaultInputArray([org])
                            input[index].roleName = existentRole.role_name!
                            const expectedErrors = [
                                createEntityAPIError(
                                    'existentChild',
                                    index,
                                    'Role',
                                    existentRole.role_name,
                                    'Organization',
                                    org.organization_id,
                                    ['organizationId', 'name']
                                ),
                            ]

                            await expectInputErrors(input, expectedErrors, 1)
                        })
                    })
                })
            })

            context('DB Calls', () => {
                it('should do the same DB calls for create 1 or 10 roles', async () => {
                    connection.logger.reset()
                    let input = [
                        {
                            organizationId: orgs[0].organization_id,
                            roleName: 'One Role',
                            roleDescription: 'Creating one role',
                        },
                    ]
                    await createRolesFromResolver(admin, input)
                    const oneRoleDBCalls = connection.logger.count

                    connection.logger.reset()
                    input = buildDefaultInputArray(orgs)
                    await createRolesFromResolver(admin, input)
                    const twentyRolesDBCalls = connection.logger.count

                    expect(oneRoleDBCalls).to.equal(twentyRolesDBCalls)
                })

                it('should do one extra DB call if caller is not admin', async () => {
                    connection.logger.reset()
                    let input = buildDefaultInputArray([orgs[0]])
                    await createRolesFromResolver(admin, input)
                    const adminDBCalls = connection.logger.count

                    connection.logger.reset()
                    input = input.map((i) => {
                        return {
                            organizationId: i.organizationId,
                            roleName: `new ${i.roleName}`,
                            roleDescription: `new ${i.roleDescription}`,
                        }
                    })
                    await createRolesFromResolver(memberWithPermission, input)
                    const nonAdminDBCalls = connection.logger.count

                    expect(nonAdminDBCalls).to.equal(adminDBCalls + 1)
                })
            })
        })

        describe('updateRoles', () => {
            let orgsData: OrgData[]
            let systemRoles: Role[]
            let customRoles: Role[]

            const updateRolesFromResolver = async (
                caller: User,
                input: UpdateRoleInput[]
            ) => {
                const permissions = new UserPermissions(userToPayload(caller))
                return mutate(UpdateRoles, { input }, permissions)
            }

            const buildDefaultInputArray = (roles: Role[]) =>
                Array.from(roles, (r, i) => {
                    return {
                        id: r.role_id,
                        roleName: `Updated Role ${i}`,
                        roleDescription: 'This role was updated',
                        permissionIds: [PermissionName.academic_profile_20100],
                    }
                })

            const expectRolesUpdated = async (
                caller: User,
                input: UpdateRoleInput[]
            ) => {
                const preloadedRoles = Role.find({
                    where: {
                        role_id: In(input.map((i) => i.id)),
                    },
                    relations: ['permissions'],
                })

                const rolesMap = new Map(
                    (await preloadedRoles).map((r) => [r.role_id, r])
                )

                const rolesAfter = new Map(
                    input.map((i) => {
                        const currentRole = rolesMap.get(i.id) as Role
                        const currentPermissionIds = (currentRole as RoleAndPermissions).__permissions__?.map(
                            (p) => p.permission_name
                        )

                        return [
                            i.id,
                            {
                                roleName: i.roleName || currentRole.role_name,
                                roleDescription:
                                    i.roleDescription ||
                                    currentRole.role_description,
                                permissionIds:
                                    i.permissionIds || currentPermissionIds,
                            },
                        ]
                    })
                )

                const { roles } = await updateRolesFromResolver(caller, input)

                expect(roles).to.have.lengthOf(input.length)
                roles.forEach(async (r) => {
                    const roleAfterRelated = rolesAfter.get(r.id)!

                    expect(roleAfterRelated).to.exist
                    expect(r.name).to.eq(roleAfterRelated.roleName)
                    expect(r.description).to.eq(
                        roleAfterRelated.roleDescription
                    )
                })

                const rolesDB = await Role.findBy({
                    role_id: In(input.map((i) => i.id)),
                })

                expect(rolesDB).to.have.lengthOf(input.length)

                rolesDB.forEach(async (rdb) => {
                    const roleAfterRelated = rolesAfter.get(rdb.role_id)!

                    expect(roleAfterRelated).to.exist
                    expect(rdb.role_name).to.eq(roleAfterRelated.roleName)
                    expect(rdb.role_description).to.eq(
                        roleAfterRelated.roleDescription
                    )

                    const permissions = await rdb.permissions
                    expect(
                        permissions?.map((p) => p.permission_name)
                    ).to.deep.equalInAnyOrder(roleAfterRelated.permissionIds)
                })
            }

            const expectPermissionError = async (
                caller: User,
                rolesToUpdate: Role[],
                systemRoleRelated?: boolean
            ) => {
                const permError = permErrorMeta(
                    PermissionName.edit_role_and_permissions_30332
                )

                const input = buildDefaultInputArray(rolesToUpdate)
                const operation = updateRolesFromResolver(caller, input)
                if (systemRoleRelated) {
                    await expect(operation).to.be.rejectedWith(
                        'On index 0, You are unauthorized to perform this action.'
                    )
                } else {
                    await expect(operation).to.be.rejectedWith(
                        permError(caller)
                    )
                }
            }

            const expectInputErrors = async (
                input: UpdateRoleInput[],
                expectedErrors: APIError[]
            ) => {
                const operation = updateRolesFromResolver(admin, input)
                await expectAPIErrorCollection(
                    operation,
                    new APIErrorCollection(expectedErrors)
                )
            }

            const expectNoChanges = async (expectedRoles: Role[]) => {
                const ids = expectedRoles.map((c) => c.role_id)
                const rolesDB = await Role.findBy({ role_id: In(ids) })

                expect(rolesDB).to.exist
                expect(rolesDB).to.have.lengthOf(expectedRoles.length)

                const expectedRolesPermissions = expectedRoles.map(async (r) =>
                    (await r.permissions)?.map((p) => p.permission_name)
                )

                for (const [i, r] of expectedRoles.entries()) {
                    const roleRelated = rolesDB.find(
                        (rdb) => r.role_id === rdb.role_id
                    ) as Role

                    expect(roleRelated).to.exist
                    expect(roleRelated.role_name).to.eq(r.role_name)
                    expect(roleRelated.role_description).to.eq(
                        r.role_description
                    )
                    expect(roleRelated.status).to.eq(r.status)
                    expect(roleRelated.system_role).to.eq(r.system_role)

                    const roleRelatedPermissions = await roleRelated.permissions

                    expect(
                        await expectedRolesPermissions[i]
                    ).to.deep.equalInAnyOrder(
                        roleRelatedPermissions?.map((p) => p.permission_name)
                    )
                }
            }

            beforeEach(async () => {
                systemRoles = await Role.find({ take: rolesCount })
                const roleForUpdate = await createARole(
                    'Update Roles',
                    undefined,
                    {
                        permissions: [
                            PermissionName.edit_role_and_permissions_30332,
                        ],
                    },
                    true
                ).save()

                orgsData = await createOrgsData()
                await createPermissionMemberships(
                    orgsData[0].org,
                    roleForUpdate
                )
                customRoles = await Promise.all(
                    orgsData.map(async (orgData, idx) => {
                        return await createARole(
                            `Custom Role for Org ${idx}`,
                            orgData.org
                        ).save()
                    })
                )
            })

            context('permissions', () => {
                context('successful cases', () => {
                    context('when caller is admin', () => {
                        it('should update any non-system roles', async () => {
                            const rolesToUpdate = orgsData
                                .map((d) => d.roles)
                                .flat()
                            rolesToUpdate.push(...customRoles)

                            const input = buildDefaultInputArray(rolesToUpdate)
                            await expectRolesUpdated(admin, input)
                        })
                    })

                    context('when caller is not admin', () => {
                        context('but has permission', () => {
                            it('should update roles from the organization which they belong to', async () => {
                                const rolesToUpdate = orgsData[0].roles
                                const input = buildDefaultInputArray(
                                    rolesToUpdate
                                )
                                await expectRolesUpdated(
                                    memberWithPermission,
                                    input
                                )
                            })
                        })
                    })
                })

                context('error handling', () => {
                    context('when caller is admin', () => {
                        context('and tries to update system roles', () => {
                            it('should throw a permission error', async () => {
                                const caller = admin
                                const rolesToUpdate = systemRoles
                                await expectPermissionError(
                                    caller,
                                    rolesToUpdate,
                                    true
                                )
                            })
                        })
                    })
                    context('when caller is not admin', () => {
                        context('but has permission', () => {
                            context(
                                'and tries to update system roles in input',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const caller = memberWithPermission
                                        const rolesToUpdate = [
                                            ...systemRoles,
                                            customRoles[0], // user has permission to update this org role in their org
                                        ]
                                        await expectPermissionError(
                                            caller,
                                            rolesToUpdate,
                                            true
                                        )
                                    })
                                }
                            )

                            context(
                                'and tries to update roles from an organization which they do not belong to',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const caller = memberWithPermission
                                        const rolesToUpdate = orgsData[1].roles
                                        await expectPermissionError(
                                            caller,
                                            rolesToUpdate
                                        )

                                        await expectNoChanges(rolesToUpdate)
                                    })
                                }
                            )
                        })

                        context('has not permission', () => {
                            context('but has membership', () => {
                                context(
                                    'and tries to update roles from the organization which they belong to',
                                    () => {
                                        it('should throw a permission error', async () => {
                                            const caller = memberWithoutPermission
                                            const rolesToUpdate =
                                                orgsData[0].roles
                                            await expectPermissionError(
                                                caller,
                                                rolesToUpdate
                                            )

                                            await expectNoChanges(rolesToUpdate)
                                        })
                                    }
                                )
                            })

                            context('has not membership', () => {
                                context('and tries to update any role', () => {
                                    it('should throw a permission error', async () => {
                                        const caller = nonMember
                                        const rolesToUpdate = orgsData
                                            .map((d) => d.roles)
                                            .flat()
                                        rolesToUpdate.push(...customRoles)

                                        await expectPermissionError(
                                            caller,
                                            rolesToUpdate
                                        )

                                        await expectNoChanges(rolesToUpdate)
                                    })
                                })
                            })
                        })
                    })
                })
            })

            context('inputs', () => {
                context('successful cases', () => {
                    context("when input just has 'id' and 'roleName'", () => {
                        it("should update just the role's name", async () => {
                            const rolesToUpdate = orgsData[0].roles
                            const input = Array.from(rolesToUpdate, (r, i) => {
                                return {
                                    id: r.role_id,
                                    roleName: `Name Changed ${i}`,
                                }
                            })

                            await expectRolesUpdated(admin, input)
                        })
                    })

                    context(
                        "when input just has 'id' and 'roleDescription'",
                        () => {
                            it("should update just the role's description", async () => {
                                const rolesToUpdate = orgsData[0].roles
                                const input = Array.from(
                                    rolesToUpdate,
                                    (r, i) => {
                                        return {
                                            id: r.role_id,
                                            roleDescription: `Description Changed ${i}`,
                                        }
                                    }
                                )

                                await expectRolesUpdated(admin, input)
                            })
                        }
                    )

                    context(
                        "when input just has 'id' and 'permissionsIds'",
                        () => {
                            it("should update just the role's permissions", async () => {
                                const rolesToUpdate = orgsData[0].roles
                                const input = Array.from(
                                    rolesToUpdate,
                                    (r, i) => {
                                        return {
                                            id: r.role_id,
                                            permissionIds: [
                                                PermissionName.academic_profile_20100,
                                                PermissionName.edit_role_and_permissions_30332,
                                            ],
                                        }
                                    }
                                )

                                await expectRolesUpdated(admin, input)
                            })
                        }
                    )

                    context(
                        "when 'roleName' already exists in another role in other organization",
                        () => {
                            it('should update thr roles', async () => {
                                const rolesToUpdate = orgsData[0].roles
                                const rolesToCopy = orgsData[1].roles
                                const input = Array.from(
                                    rolesToUpdate,
                                    (r, i) => {
                                        return {
                                            id: r.role_id,
                                            roleName: rolesToCopy[i].role_name,
                                        }
                                    }
                                )

                                await expectRolesUpdated(admin, input)
                            })
                        }
                    )
                })

                context('error handling', () => {
                    context("when input just has 'id'", () => {
                        it('should throw an ErrorCollection', async () => {
                            const rolesToUpdate = orgsData[0].roles
                            const input = Array.from(rolesToUpdate, (r) => {
                                return {
                                    id: r.role_id,
                                }
                            })

                            const expectedErrors = Array.from(input, (_, i) =>
                                createInputRequiresAtLeastOne(i, 'Role', [
                                    'roleName',
                                    'roleDescription',
                                    'permissionIds',
                                ])
                            )

                            await expectInputErrors(input, expectedErrors)
                            await expectNoChanges(rolesToUpdate)
                        })
                    })

                    context(
                        "when 'roleName' already exists in another role in the same organization",
                        () => {
                            it('should throw an ErrorCollection', async () => {
                                const dataToUse = orgsData[0]
                                const organizationId =
                                    dataToUse.org.organization_id

                                const rolesToUpdate = dataToUse.roles.slice(
                                    0,
                                    rolesCount - 1
                                )

                                const rolesToCopy = dataToUse.roles.slice(
                                    1,
                                    rolesCount
                                )

                                const input = Array.from(
                                    rolesToUpdate,
                                    (r, i) => {
                                        return {
                                            id: r.role_id,
                                            roleName: rolesToCopy[i].role_name,
                                        }
                                    }
                                )

                                const expectedErrors = Array.from(
                                    input,
                                    (i, index) =>
                                        createEntityAPIError(
                                            'existentChild',
                                            index,
                                            'Role',
                                            i.roleName,
                                            'Organization',
                                            organizationId,
                                            ['organizationId', 'name']
                                        )
                                )

                                await expectInputErrors(input, expectedErrors)
                                await expectNoChanges(rolesToUpdate)
                            })
                        }
                    )

                    context(
                        "when 'roleName' is duplicated on input for roles in the same organization",
                        () => {
                            it('should throw an ErrorCollection', async () => {
                                const rolesToUpdate = orgsData[0].roles
                                const input = Array.from(rolesToUpdate, (r) => {
                                    return {
                                        id: r.role_id,
                                        roleName: 'Duplicated Name',
                                    }
                                })

                                const expectedErrors = Array.from(
                                    input.slice(1, input.length),
                                    (_, i) =>
                                        createDuplicateAttributeAPIError(
                                            i + 1,
                                            ['roleName'],
                                            'UpdateRoleInput'
                                        )
                                )

                                await expectInputErrors(input, expectedErrors)
                                await expectNoChanges(rolesToUpdate)
                            })
                        }
                    )

                    context("when 'permissionIds' are duplicated", () => {
                        it('should throw an ErrorCollection', async () => {
                            const permissionToUse =
                                PermissionName.academic_profile_20100

                            const rolesToUpdate = orgsData[0].roles
                            const input = Array.from(rolesToUpdate, (r, i) => {
                                return {
                                    id: r.role_id,
                                    permissionIds: [
                                        permissionToUse,
                                        permissionToUse,
                                    ],
                                }
                            })

                            const expectedErrors = Array.from(input, (_, i) =>
                                createDuplicateAttributeAPIError(
                                    i,
                                    ['permissionIds'],
                                    'UpdateRoleInput'
                                )
                            )

                            await expectInputErrors(input, expectedErrors)
                            await expectNoChanges(rolesToUpdate)
                        })
                    })

                    context(
                        "when a permission of 'permissionIds' does not exists",
                        () => {
                            it('should throw an ErrorCollection', async () => {
                                const nonExistingPermissionId =
                                    'i_do_not_exist_1234'

                                const rolesToUpdate = orgsData[0].roles
                                const input = Array.from(
                                    rolesToUpdate,
                                    (r) => ({
                                        id: r.role_id,
                                        permissionIds: [
                                            nonExistingPermissionId,
                                        ],
                                    })
                                )

                                const expectedErrors = Array.from(
                                    input,
                                    (_, i) =>
                                        createEntityAPIError(
                                            'nonExistent',
                                            i,
                                            'Permission',
                                            nonExistingPermissionId
                                        )
                                )

                                await expectInputErrors(input, expectedErrors)
                                await expectNoChanges(rolesToUpdate)
                            })
                        }
                    )

                    context(
                        "when a permission of 'permissionIds' is inactive",
                        () => {
                            let inactivePermission: Permission

                            beforeEach(async () => {
                                inactivePermission = await Permission.findOneByOrFail(
                                    {
                                        permission_name:
                                            PermissionName.academic_profile_20100,
                                    }
                                )

                                await inactivePermission.inactivate()
                                await inactivePermission.save()
                            })

                            it('should throw an ErrorCollection', async () => {
                                const rolesToUpdate = orgsData[0].roles
                                const input = Array.from(rolesToUpdate, (r) => {
                                    return {
                                        id: r.role_id,
                                        permissionIds: [
                                            inactivePermission.permission_name,
                                        ],
                                    }
                                })

                                const expectedErrors = Array.from(
                                    input,
                                    (_, i) =>
                                        createEntityAPIError(
                                            'nonExistent',
                                            i,
                                            'Permission',
                                            inactivePermission.permission_name
                                        )
                                )

                                await expectInputErrors(input, expectedErrors)
                                await expectNoChanges(rolesToUpdate)
                            })
                        }
                    )

                    context(
                        "when a permission of 'permissionIds' is only for super admins",
                        () => {
                            let superAdminPermission: Permission

                            beforeEach(async () => {
                                superAdminPermission = await Permission.findOneByOrFail(
                                    {
                                        permission_level:
                                            superAdminRole.role_name,
                                    }
                                )
                            })

                            it('should throw an ErrorCollection', async () => {
                                const rolesToUpdate = orgsData[0].roles
                                const input = Array.from(
                                    rolesToUpdate,
                                    (r) => ({
                                        id: r.role_id,
                                        permissionIds: [
                                            superAdminPermission.permission_name,
                                        ],
                                    })
                                )

                                const expectedErrors = Array.from(
                                    input,
                                    (_, i) =>
                                        createEntityAPIError(
                                            'nonExistent',
                                            i,
                                            'Permission',
                                            superAdminPermission.permission_id
                                        )
                                )

                                await expectInputErrors(input, expectedErrors)
                                await expectNoChanges(rolesToUpdate)
                            })
                        }
                    )
                })
            })

            context('DB Calls', () => {
                it('should do the same DB calls for update 1 or 10 roles', async () => {
                    const rolesToUpdate = orgsData.map((d) => d.roles).flat()
                    let input = buildDefaultInputArray(rolesToUpdate)

                    // warm up permission caches
                    await updateRolesFromResolver(admin, input)

                    input = buildDefaultInputArray([rolesToUpdate[0]])
                    connection.logger.reset()
                    await updateRolesFromResolver(admin, input)
                    const oneRoleDBCalls = connection.logger.count

                    input = buildDefaultInputArray(rolesToUpdate)
                    connection.logger.reset()
                    await updateRolesFromResolver(admin, input)
                    const tenRolesDBCalls = connection.logger.count

                    expect(oneRoleDBCalls).to.equal(tenRolesDBCalls)
                })

                it('should do one extra DB call if caller is not admin', async () => {
                    const rolesToUpdate = orgsData[0].roles
                    const input = buildDefaultInputArray(rolesToUpdate)

                    // warm up permission caches
                    await updateRolesFromResolver(admin, input)

                    connection.logger.reset()
                    await updateRolesFromResolver(admin, input)
                    const adminDBCalls = connection.logger.count

                    connection.logger.reset()
                    await updateRolesFromResolver(memberWithPermission, input)
                    const nonAdminDBCalls = connection.logger.count

                    expect(nonAdminDBCalls).to.equal(adminDBCalls + 1)
                })
            })
        })

        describe('deleteRoles', () => {
            let orgsData: OrgData[]
            let systemRoles: Role[]
            let rolesTotalCount: number

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

                const rolesDB = await Role.findBy({
                    role_id: In(input.map((i) => i.id)),
                })

                expect(rolesDB).to.have.lengthOf(input.length)
                rolesDB.forEach((rdb) => {
                    const inputRelated = input.find((i) => i.id === rdb.role_id)
                    expect(inputRelated).to.exist
                    expect(rdb.role_id).to.eq(inputRelated?.id)
                    expect(rdb.status).to.eq(Status.INACTIVE)
                })
            }

            const expectPermissionError = async (
                caller: User,
                rolesToDelete: Role[],
                systemRoleRelated?: boolean
            ) => {
                const permError = permErrorMeta(
                    PermissionName.delete_role_30440
                )
                const input = buildInputArray(rolesToDelete)
                const operation = deleteRolesFromResolver(caller, input)

                if (systemRoleRelated) {
                    await expect(operation).to.be.rejectedWith(
                        'System roles cannot be modified'
                    )
                } else {
                    await expect(operation).to.be.rejectedWith(
                        permError(caller)
                    )
                }
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
                systemRoles = await Role.find({ take: rolesCount })
                const roleForDelete = await createARole(
                    'Update Roles',
                    undefined,
                    { permissions: [PermissionName.delete_role_30440] },
                    true
                ).save()

                orgsData = await createOrgsData()
                await createPermissionMemberships(
                    orgsData[0].org,
                    roleForDelete
                )

                rolesTotalCount = await Role.countBy({
                    system_role: false,
                })
            })

            context('permissions', () => {
                context('successful cases', () => {
                    context('when caller is admin', () => {
                        it('should delete any non-system roles', async () => {
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
                    context('when caller is admin', () => {
                        context('and tries to delete system roles', () => {
                            it('should throw a permission error', async () => {
                                const caller = admin
                                const rolesToDelete = systemRoles
                                await expectPermissionError(
                                    caller,
                                    rolesToDelete,
                                    true
                                )
                            })
                        })
                    })

                    context('when caller is not admin', () => {
                        context('but has permission', () => {
                            context(
                                'and tries to delete roles from an organization which they do not belong to',
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
                            context('and tries to delete system roles', () => {
                                it('should throw a permission error', async () => {
                                    const caller = memberWithPermission
                                    const rolesToDelete = [
                                        ...orgsData[0].roles,
                                        ...systemRoles,
                                    ]
                                    await expectPermissionError(
                                        caller,
                                        rolesToDelete,
                                        true
                                    )
                                })
                            })
                        })

                        context('has not permission', () => {
                            context('but has membership', () => {
                                context(
                                    'and tries to delete roles from the organization which they belong to',
                                    () => {
                                        it('should throw a permission error', async () => {
                                            const caller = memberWithoutPermission
                                            const rolesToDelete =
                                                orgsData[0].roles
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
                    context(
                        'when roles belong to the same organization',
                        () => {
                            it('should do 3 DB calls', async () => {
                                const rolesToDelete = orgsData[0].roles
                                await expectDBCalls(
                                    rolesToDelete,
                                    admin,
                                    3,
                                    '1 for get roles; 1 for get caller user; and 1 for save changes'
                                )
                            })
                        }
                    )

                    context(
                        'when roles belong to more than one organization',
                        () => {
                            it('should do 3 DB calls', async () => {
                                const rolesToDelete = [
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

    describe('#memberships', () => {
        let organization: Organization
        let memberships: OrganizationMembership[]
        let systemRole: Role
        beforeEach(async () => {
            organization = await createOrganization().save()
            const user = await createUser().save()
            systemRole = await Role.findOneByOrFail({
                system_role: true,
                role_name: organizationAdminRole.role_name,
            })
            memberships = [
                await createOrganizationMembership({
                    user,
                    organization,
                    roles: [systemRole],
                }).save(),
            ]
        })
        it('restricts results using organizationMembership isAdmin scope', async () => {
            const query = `
                query {
                    roles {
                        memberships {
                            user_id
                        }
                    }
                }
            `

            const clientUser = await createUser().save()
            const authorization = generateToken(userToPayload(clientUser))

            let result = await runQuery(query, testClient, {
                authorization,
            })
            expect(
                result!.roles.map((r: Role) => r.memberships).flat().length
            ).to.equal(0)

            memberships.push(
                await createOrganizationMembership({
                    user: clientUser,
                    organization,
                    roles: [systemRole],
                }).save()
            )

            result = await runQuery(query, testClient, {
                authorization,
            })
            expect(
                result!.roles.map((r: Role) => r.memberships).flat().length
            ).to.equal(memberships.length)
        })
    })
})
