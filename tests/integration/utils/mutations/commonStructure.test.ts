import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getManager, In } from 'typeorm'
import { config } from '../../../../src/config/config'
import { Category } from '../../../../src/entities/category'
import { Organization } from '../../../../src/entities/organization'
import { Status } from '../../../../src/entities/status'
import { User } from '../../../../src/entities/user'
import { Model } from '../../../../src/model'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { DeleteCategories } from '../../../../src/resolvers/category'
import {
    CategoriesMutationResult,
    DeleteCategoryInput,
} from '../../../../src/types/graphQL/category'
import { mutate } from '../../../../src/utils/mutations/commonStructure'
import { createServer } from '../../../../src/utils/createServer'
import { createInputLengthAPIError } from '../../../../src/utils/resolvers'
import { createCategories } from '../../../factories/category.factory'
import {
    createOrganization,
    createOrganizations,
} from '../../../factories/organization.factory'
import { createAdminUser, createUsers } from '../../../factories/user.factory'
import { expectAPIError, compareErrors } from '../../../utils/apiError'
import { userToPayload } from '../../../utils/operations/userOps'
import {
    createTestConnection,
    TestConnection,
} from '../../../utils/testConnection'
import { Role } from '../../../../src/entities/role'
import {
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
    RemoveUsersFromOrganizationInput,
} from '../../../../src/types/graphQL/organization'
import { createRoles } from '../../../factories/role.factory'
import {
    AddUsersToOrganizations,
    RemoveUsersFromOrganizations,
} from '../../../../src/resolvers/organization'
import { OrganizationMembership } from '../../../../src/entities/organizationMembership'
import { createOrganizationMemberships } from '../../../factories/organizationMembership.factory'

use(chaiAsPromised)

describe('commonStructure', () => {
    let connection: TestConnection
    let admin: User
    let categories: Category[]

    before(async () => {
        connection = await createTestConnection()
        await createServer(new Model(connection))
    })

    after(async () => connection.close())

    beforeEach(async () => {
        admin = await createAdminUser().save()
    })

    async function generateCategories(count: number): Promise<void> {
        const org: Organization = await createOrganization().save()
        categories = await Category.save(createCategories(count, org))
    }

    async function deleteEntity(
        input: DeleteCategoryInput[]
    ): Promise<CategoriesMutationResult> {
        const ctx = {
            permissions: new UserPermissions(userToPayload(admin)),
        }
        return mutate(DeleteCategories, { input }, ctx.permissions)
    }

    function generateDeleteInput() {
        return categories.map((c) => {
            return { id: c.id }
        })
    }

    function expectNonExistentCategory(
        res: any,
        id: string,
        inputIndex: number,
        errorIndex: number,
        errorCount: number
    ) {
        expectAPIError.nonexistent_entity(
            res,
            {
                entity: 'Category',
                entityName: id,
                index: inputIndex,
            },
            ['id'],
            errorIndex,
            errorCount
        )
    }

    function expectDuplicateDeleteCategory(
        res: any,
        inputIndex: number,
        errorIndex: number,
        errorCount: number
    ) {
        expectAPIError.duplicate_attribute_values(
            res,
            {
                entity: 'DeleteCategoryInput',
                attribute: '(id)',
                index: inputIndex,
            },
            ['id'],
            errorIndex,
            errorCount
        )
    }

    /**
     * Using DeleteCategories to test common methods of mutations
     */
    describe('mutation', () => {
        let currentInput: DeleteCategoryInput[]

        context('#validateInputLength', () => {
            function createMockInputs(count: number): void {
                currentInput = []
                for (let i = 0; i < count; i++) {
                    currentInput.push({ id: `id-${i}` })
                }
            }

            context('when there are less inputs than allowed', () => {
                beforeEach(() => {
                    const minCount = config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE
                    createMockInputs(minCount - 1)
                })

                it('throws an input length error', async () => {
                    const xError = createInputLengthAPIError('Category', 'min')
                    const res = await expect(deleteEntity(currentInput)).to.be
                        .rejected
                    compareErrors(res, xError)
                })
            })
            context('when there are more inputs than allowed', () => {
                beforeEach(() => {
                    const maxCount = config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE
                    createMockInputs(maxCount + 1)
                })

                it('throws an input length error', async () => {
                    const xError = createInputLengthAPIError('Category', 'max')
                    const res = await expect(deleteEntity(currentInput)).to.be
                        .rejected
                    compareErrors(res, xError)
                })
            })
        })

        context('#commonValidations', () => {
            context('when the inputs are correct', () => {
                beforeEach(() => generateCategories(5))

                it('passes validation', async () => {
                    await expect(deleteEntity(generateDeleteInput())).to.be
                        .fulfilled
                })
            })
            context('when there are duplicate ids of the entity', () => {
                beforeEach(async () => {
                    await generateCategories(5)
                    currentInput = generateDeleteInput()
                    currentInput.push(currentInput[3])
                })

                it('throws a duplicate_attribute_values error', async () => {
                    const res = await expect(deleteEntity(currentInput)).to.be
                        .rejected
                    expectAPIError.duplicate_attribute_values(
                        res,
                        {
                            entity: 'DeleteCategoryInput',
                            attribute: '(id)',
                            index: 5,
                        },
                        ['id'],
                        0,
                        1
                    )
                })
            })

            context('when the entity is inactivated', () => {
                let inactiveCategory: Category
                beforeEach(async () => {
                    await generateCategories(5)
                    inactiveCategory = categories[2]
                    await inactiveCategory.inactivate(getManager())
                })

                it('throws a nonexistent_entity error', async () => {
                    const res = await expect(
                        deleteEntity(generateDeleteInput())
                    ).to.be.rejected
                    expectNonExistentCategory(res, inactiveCategory.id, 2, 0, 1)
                })
            })

            context('when an entity is inactivated and duplicated', () => {
                let inactiveCategory: Category
                beforeEach(async () => {
                    await generateCategories(5)
                    currentInput = generateDeleteInput()
                    inactiveCategory = categories[2]
                    await inactiveCategory.inactivate(getManager())
                    currentInput.push(inactiveCategory, inactiveCategory)
                })

                it('throws nonexistent_entity at first occurrence, and throws duplicate_attribute_values henceforth', async () => {
                    const res = await expect(deleteEntity(currentInput)).to.be
                        .rejected
                    expectNonExistentCategory(res, inactiveCategory.id, 2, 0, 3)
                    expectDuplicateDeleteCategory(res, 5, 1, 3)
                    expectDuplicateDeleteCategory(res, 6, 2, 3)
                })
            })
        })
    })

    /**
     * Using CreateCategories to test common methods of
     * CreateXs & UpdateXs mutations
     */
    // describe('createMutation', () => {
    //     context('#applyToDatabase', () => {})
    // })

    /**
     * Using DeleteCategories to test common methods of DeleteXs mutations
     */
    describe('deleteMutation', () => {
        context('#run', () => {
            context('when deleting 1 then 50 categories', () => {
                it('makes the same number of database calls', async () => {
                    await generateCategories(1)
                    connection.logger.reset()
                    await expect(deleteEntity(generateDeleteInput())).to.be
                        .fulfilled
                    const baseCount = connection.logger.count

                    await generateCategories(50)
                    connection.logger.reset()
                    await expect(deleteEntity(generateDeleteInput())).to.be
                        .fulfilled
                    expect(connection.logger.count).to.equal(baseCount)
                })
            })
        })
        context('#applyToDatabase', () => {
            beforeEach(() => generateCategories(5))
            it('successfully deletes the entities', async () => {
                await expect(deleteEntity(generateDeleteInput())).to.be
                    .fulfilled
                expect(
                    await Category.count({
                        where: {
                            id: In(categories.map((c) => c.id)),
                            status: Status.INACTIVE,
                        },
                    })
                ).to.equal(categories.length)
            })
        })
    })

    /**
     * Using AddSubcategoriesToCategories to test common methods of
     * AddXsToYs & Remove XsFromYs mutations
     */
    // describe('addRemoveMutation', () => {
    //     context('#applyToDatabase', () => {})
    // })

    /**
     * Using AddUsersToOrganisations to test common methods of
     * AddXsToYs mutations which involve SchoolMemberships
     * or OrganizationMemberships
     */
    describe('addMembershipMutation', () => {
        let organizations: Organization[]
        let users: User[]
        let roles: Role[]
        let membershipCount: number

        function generateInput(
            orgs: Organization[],
            usrs: User[],
            rls: Role[]
        ): AddUsersToOrganizationInput[] {
            membershipCount = orgs.length * usrs.length
            return orgs.map((o) => {
                return {
                    organizationId: o.organization_id,
                    userIds: usrs.map((u) => u.user_id),
                    organizationRoleIds: rls.map((r) => r.role_id),
                }
            })
        }

        async function addMemberships(
            input: AddUsersToOrganizationInput[]
        ): Promise<OrganizationsMutationResult> {
            const permissions = new UserPermissions(userToPayload(admin))
            return mutate(AddUsersToOrganizations, { input }, permissions)
        }

        beforeEach(async () => {
            roles = await Role.save(createRoles(3))
        })

        context('#run', () => {
            context('when adding 1 then 60 memberships', () => {
                it('makes the same number of database calls', async () => {
                    organizations = await Organization.save(
                        createOrganizations(1)
                    )
                    users = await User.save(createUsers(1))
                    let input = generateInput(organizations, users, roles)
                    connection.logger.reset()
                    await expect(addMemberships(input)).to.be.fulfilled
                    const baseCount = connection.logger.count

                    organizations = await Organization.save(
                        createOrganizations(3)
                    )
                    users = await User.save(createUsers(20))
                    input = generateInput(organizations, users, roles)
                    connection.logger.reset()
                    await expect(addMemberships(input)).to.be.fulfilled
                    expect(connection.logger.count).to.equal(baseCount)
                })
            })
        })
        context('#applyToDatabase', () => {
            beforeEach(async () => {
                organizations = await Organization.save(createOrganizations(1))
                users = await User.save(createUsers(1))
            })
            it('successfully adds the memberships', async () => {
                const input = generateInput(organizations, users, roles)
                await expect(addMemberships(input)).to.be.fulfilled
                expect(
                    await OrganizationMembership.count({
                        where: {
                            user_id: In(users.map((u) => u.user_id)),
                            organization_id: In(
                                organizations.map((o) => o.organization_id)
                            ),
                            status: Status.ACTIVE,
                        },
                    })
                ).to.equal(membershipCount)
            })
        })
    })

    /**
     * Using RemoveUsersFromOrganisations to test common methods of
     * RemoveXsFromYs mutations which involve SchoolMemberships
     * or OrganizationMemberships
     */
    describe('removeMembershipMutation', () => {
        let organizations: Organization[]
        let users: User[]
        let membershipCount: number

        function saveMemberships(
            orgs: Organization[],
            usrs: User[]
        ): Promise<OrganizationMembership[]> {
            return OrganizationMembership.save(
                orgs.flatMap((o) => createOrganizationMemberships(usrs, o))
            )
        }

        function generateInput(
            orgs: Organization[],
            usrs: User[]
        ): RemoveUsersFromOrganizationInput[] {
            membershipCount = orgs.length * usrs.length
            return orgs.map((o) => {
                return {
                    organizationId: o.organization_id,
                    userIds: usrs.map((u) => u.user_id),
                }
            })
        }

        async function removeMemberships(
            input: RemoveUsersFromOrganizationInput[]
        ): Promise<OrganizationsMutationResult> {
            const permissions = new UserPermissions(userToPayload(admin))
            return mutate(RemoveUsersFromOrganizations, { input }, permissions)
        }

        context('#run', () => {
            context('when deleting 1 then 60 memberships', () => {
                it('makes the same number of database calls', async () => {
                    organizations = await Organization.save(
                        createOrganizations(1)
                    )
                    users = await User.save(createUsers(1))
                    await saveMemberships(organizations, users)
                    let input = generateInput(organizations, users)
                    connection.logger.reset()
                    await expect(removeMemberships(input)).to.be.fulfilled
                    const baseCount = connection.logger.count

                    organizations = await Organization.save(
                        createOrganizations(3)
                    )
                    users = await User.save(createUsers(20))
                    await saveMemberships(organizations, users)
                    input = generateInput(organizations, users)
                    connection.logger.reset()
                    await expect(removeMemberships(input)).to.be.fulfilled
                    expect(connection.logger.count).to.equal(baseCount)
                })
            })
        })
        context('#applyToDatabase', () => {
            beforeEach(async () => {
                organizations = await Organization.save(createOrganizations(1))
                users = await User.save(createUsers(1))
                await saveMemberships(organizations, users)
            })
            it('successfully deletes the memberships', async () => {
                const input = generateInput(organizations, users)
                await expect(removeMemberships(input)).to.be.fulfilled
                expect(
                    await OrganizationMembership.count({
                        where: {
                            user_id: In(users.map((u) => u.user_id)),
                            organization_id: In(
                                organizations.map((o) => o.organization_id)
                            ),
                            status: Status.INACTIVE,
                        },
                    })
                ).to.equal(membershipCount)
            })
        })
    })
})
