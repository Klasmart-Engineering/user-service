import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getManager, In } from 'typeorm'
import { Connection } from 'typeorm/connection/Connection'
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
import { mutate } from '../../../../src/utils/ mutations/commonStructure'
import { createServer } from '../../../../src/utils/createServer'
import { createInputLengthAPIError } from '../../../../src/utils/resolvers'
import { createCategories } from '../../../factories/category.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { createAdminUser } from '../../../factories/user.factory'
import { expectAPIError, compareErrors } from '../../../utils/apiError'
import { userToPayload } from '../../../utils/operations/userOps'
import { createTestConnection } from '../../../utils/testConnection'

use(chaiAsPromised)

describe('commonStructure', () => {
    let connection: Connection
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

    async function mutateDelete(
        user: User,
        input: DeleteCategoryInput[]
    ): Promise<CategoriesMutationResult> {
        const ctx = {
            permissions: new UserPermissions(userToPayload(user)),
        }
        return mutate(DeleteCategories, { input }, ctx)
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

    // Using DeleteCategories to test common methods of mutations
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
                    const res = await expect(mutateDelete(admin, currentInput))
                        .to.be.rejected
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
                    const res = await expect(mutateDelete(admin, currentInput))
                        .to.be.rejected
                    compareErrors(res, xError)
                })
            })
        })

        context('#commonValidations', () => {
            context('when the inputs are correct', () => {
                beforeEach(() => generateCategories(5))

                it('passes validation', async () => {
                    await expect(mutateDelete(admin, generateDeleteInput())).to
                        .be.fulfilled
                })
            })
            context('when there are duplicate ids of the entity', () => {
                beforeEach(async () => {
                    await generateCategories(5)
                    currentInput = generateDeleteInput()
                    currentInput.push(currentInput[3])
                })

                it('throws a duplicate_attribute_values error', async () => {
                    const res = await expect(mutateDelete(admin, currentInput))
                        .to.be.rejected
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
                        mutateDelete(admin, generateDeleteInput())
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
                    const res = await expect(mutateDelete(admin, currentInput))
                        .to.be.rejected
                    expectNonExistentCategory(res, inactiveCategory.id, 2, 0, 3)
                    expectDuplicateDeleteCategory(res, 5, 1, 3)
                    expectDuplicateDeleteCategory(res, 6, 2, 3)
                })
            })
        })
    })

    // Using CreateCategories to test common methods of
    // CreateXs & UpdateXs mutations
    // describe('createMutation', () => {
    //     context('#applyToDatabase', () => {})
    // })

    // Using DeleteCategories to test common methods of DeleteXs mutations
    describe('deleteMutation', () => {
        context('#applyToDatabase', () => {
            beforeEach(() => generateCategories(5))
            it('successfully deletes the entities', async () => {
                await expect(mutateDelete(admin, generateDeleteInput())).to.be
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

    // Using AddSubcategories to Categories to test common methods of
    // AddXsToYs & Remove XsFromYs mutations
    // describe('addRemoveMutation', () => {
    //     context('#applyToDatabase', () => {})
    // })
})
