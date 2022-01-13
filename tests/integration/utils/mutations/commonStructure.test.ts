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
import {
    DeleteEntityMap,
    DeleteMutation,
    mutate,
} from '../../../../src/utils/mutations/commonStructure'
import { createServer } from '../../../../src/utils/createServer'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
} from '../../../../src/utils/resolvers/errors'
import {
    createCategories,
    createCategory,
} from '../../../factories/category.factory'
import { createOrganizations } from '../../../factories/organization.factory'
import { createAdminUser, createUsers } from '../../../factories/user.factory'
import { compareErrors } from '../../../utils/apiError'
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
import { Context } from '../../../../src/main'
import sinon, { SinonFakeTimers } from 'sinon'
import { mapCategoryToCategoryConnectionNode } from '../../../../src/pagination/categoriesConnection'

use(chaiAsPromised)

describe('commonStructure', () => {
    let connection: TestConnection
    let admin: User

    before(async () => {
        connection = await createTestConnection()
        await createServer(new Model(connection))
    })

    after(async () => connection.close())

    beforeEach(async () => {
        admin = await createAdminUser().save()
    })

    async function deleteEntity(
        input: DeleteCategoryInput[]
    ): Promise<CategoriesMutationResult> {
        const permissions = new UserPermissions(userToPayload(admin))
        return mutate(DeleteCategories, { input }, permissions)
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
    })

    /**
     * Using CreateCategories to test common methods of
     * CreateXs & UpdateXs mutations
     */
    // describe('createMutation', () => {
    //     context('#applyToDatabase', () => {})
    // })

    // this tests only the methods defined by DeleteMutation
    // not the dummy implementations of its abstract methods
    // those should be tested seperatly for each real child class
    describe('deleteMutation', () => {
        class DeleteTest extends DeleteMutation<
            Category,
            { id: string },
            CategoriesMutationResult
        > {
            readonly EntityType = Category
            readonly inputTypeName = 'TestInput'
            protected readonly output: CategoriesMutationResult = {
                categories: [],
            }
            protected readonly mainEntityIds: string[]
            // this is used to avoid needing to access
            // the real db in generateEntityMaps
            protected existingCategories: Category[]

            constructor(
                input: { id: string }[],
                permissions: Context['permissions'],
                existingCategories: Category[]
            ) {
                super(input, permissions)
                this.mainEntityIds = input.map((val) => val.id)
                this.existingCategories = existingCategories
            }

            async generateEntityMaps(): Promise<DeleteEntityMap<Category>> {
                return {
                    mainEntity: new Map(
                        this.existingCategories.map((c) => [c.id, c])
                    ),
                }
            }

            async authorize() {
                return
            }

            async buildOutput(): Promise<void> {
                return
            }
        }

        let inputCategories: Category[]
        let inputs: { id: string }[]
        let permissions: UserPermissions
        let categoriesMap: Map<string, Category>

        beforeEach(async () => {
            permissions = new UserPermissions(userToPayload(admin))
            inputCategories = await createCategories(5)
            await Category.save(inputCategories)
            inputs = inputCategories.map(({ id }) => {
                return {
                    id,
                }
            })
            categoriesMap = new Map(inputCategories.map((c) => [c.id, c]))
        })

        context('#run', () => {
            it('does not error', async () => {
                await expect(
                    new DeleteTest(inputs, permissions, inputCategories).run()
                ).to.be.fulfilled
            })
        })

        context('#validationOverAllInputs', () => {
            it('returns all inputs and no errors when input IDs are active and not duplicated', async () => {
                const mutation = new DeleteTest(
                    inputs,
                    permissions,
                    inputCategories
                )
                const {
                    validInputs,
                    apiErrors,
                } = mutation.validationOverAllInputs(
                    inputs,
                    await mutation.generateEntityMaps()
                )
                const expectedValidInputs = inputs.map((input, index) => {
                    return {
                        input,
                        index,
                    }
                })
                expect(validInputs).to.deep.equal(expectedValidInputs)
                expect(apiErrors).to.have.length(0)
            })

            context('when there are duplicate ids of the entity', () => {
                beforeEach(async () => {
                    inputs[0] = inputs[1]
                })

                it('returns a duplicate_attribute_values error', async () => {
                    const mutation = new DeleteTest(
                        inputs,
                        permissions,
                        inputCategories
                    )
                    const {
                        validInputs,
                        apiErrors,
                    } = mutation.validationOverAllInputs(
                        inputs,
                        await mutation.generateEntityMaps()
                    )

                    const expectedValidInputs = inputs.map((input, index) => {
                        return {
                            input,
                            index,
                        }
                    })
                    expectedValidInputs.splice(1, 1)
                    expect(validInputs).to.deep.equal(expectedValidInputs)
                    expect(apiErrors).to.have.length(1)
                    const error = createDuplicateAttributeAPIError(
                        1,
                        ['id'],
                        mutation.inputTypeName
                    )
                    compareErrors(apiErrors[0], error)
                })
            })

            context('when the entity is inactivated', () => {
                let inactiveCategory: Category

                beforeEach(async () => {
                    inactiveCategory = inputCategories[0]
                    await inactiveCategory.inactivate(getManager())
                })

                it('returns a nonexistent_entity error', async () => {
                    const mutation = new DeleteTest(
                        inputs,
                        permissions,
                        inputCategories
                    )
                    const {
                        validInputs,
                        apiErrors,
                    } = mutation.validationOverAllInputs(
                        inputs,
                        await mutation.generateEntityMaps()
                    )

                    const expectedValidInputs = inputs
                        .map((input, index) => {
                            return {
                                input,
                                index,
                            }
                        })
                        .slice(1)
                    expect(validInputs).to.deep.equal(expectedValidInputs)
                    expect(apiErrors).to.have.length(1)
                    const error = createEntityAPIError(
                        'nonExistent',
                        0,
                        mutation.EntityType.name,
                        inputs[0].id
                    )
                    compareErrors(apiErrors[0], error)
                })
            })

            context('when an entity is inactivated and duplicated', () => {
                let inactiveCategory: Category

                beforeEach(async () => {
                    inactiveCategory = inputCategories[0]
                    await inactiveCategory.inactivate(getManager())
                    inputs[1] = inputs[0]
                })

                it('returns nonexistent_entity at first occurrence, and duplicate_attribute_values otherwise', async () => {
                    const mutation = new DeleteTest(
                        inputs,
                        permissions,
                        inputCategories
                    )
                    const {
                        validInputs,
                        apiErrors,
                    } = mutation.validationOverAllInputs(
                        inputs,
                        await mutation.generateEntityMaps()
                    )
                    const expectedValidInputs = inputs
                        .map((input, index) => {
                            return {
                                input,
                                index,
                            }
                        })
                        .slice(2)
                    expect(validInputs).to.deep.equal(expectedValidInputs)
                    expect(apiErrors).to.have.length(2)
                    const inactiveError = createEntityAPIError(
                        'nonExistent',
                        0,
                        mutation.EntityType.name,
                        inputs[0].id
                    )
                    compareErrors(apiErrors[0], inactiveError)
                    const duplicateError = createDuplicateAttributeAPIError(
                        1,
                        ['id'],
                        mutation.inputTypeName
                    )
                    compareErrors(apiErrors[1], duplicateError)
                })
            })
        })

        context('#validate', () => {
            // delete doesn't do any per-input validation
            // because the ids have already been checked in validationOverAllInputs
            it('returns no errors', () => {
                const mutation = new DeleteTest(
                    inputs,
                    permissions,
                    inputCategories
                )
                expect(mutation.validate()).to.be.empty
            })
        })

        context('#process', () => {
            let clock: SinonFakeTimers
            let result: {
                outputEntity: Category
            }
            beforeEach(async () => {
                clock = sinon.useFakeTimers()
                const mutation = new DeleteTest(
                    inputs,
                    permissions,
                    inputCategories
                )
                result = mutation.process(
                    inputs[0],
                    await mutation.generateEntityMaps(),
                    0
                )
            })

            afterEach(() => {
                clock.restore()
            })

            it('returns the correct entity', () => {
                expect(result.outputEntity.id).to.eq(inputs[0].id)
            })

            it('sets its status to inactive', async () => {
                expect(result.outputEntity.status).to.eq(Status.INACTIVE)
            })

            it('sets its deleted_at date', () => {
                expect(result.outputEntity.deleted_at).to.deep.equal(
                    new clock.Date()
                )
            })
        })

        context('#applyToDatabase', () => {
            let clock: SinonFakeTimers
            let notInputCategory: Category
            beforeEach(async () => {
                clock = sinon.useFakeTimers()
                notInputCategory = await createCategory()
                await Category.save(notInputCategory)
                connection.logger.reset()
                const mutation = new DeleteTest(
                    inputs,
                    permissions,
                    inputCategories
                )
                await mutation.applyToDatabase()
            })

            afterEach(() => {
                clock.restore()
            })

            it('makes the input entities inactive', async () => {
                const dbCategories = await Category.findByIds(
                    inputs.map(({ id }) => id)
                )
                for (const dbCategory of dbCategories) {
                    expect(dbCategory.deleted_at).to.deep.equal(
                        new clock.Date()
                    )
                    expect(
                        mapCategoryToCategoryConnectionNode(dbCategory)
                    ).to.deep.equal({
                        ...mapCategoryToCategoryConnectionNode(
                            categoriesMap.get(dbCategory.id)!
                        ),
                        status: Status.INACTIVE,
                    })
                }
            })
            it('does not delete other entities', async () => {
                const dbNotDeleted = await Category.findByIds([
                    notInputCategory.id,
                ])
                expect(dbNotDeleted).to.have.lengthOf(1)
                expect(
                    mapCategoryToCategoryConnectionNode(dbNotDeleted[0])
                ).to.deep.equal(
                    mapCategoryToCategoryConnectionNode(notInputCategory)
                )
            })
            it('makes 1 query', () => {
                expect(connection.logger.count).to.eq(1)
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
