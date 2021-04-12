import { EntityManager } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { CategoryRow } from '../../types/csv/categoryRow'

export async function processCategoryFromCSVRow(
    manager: EntityManager,
    row: CategoryRow,
    rowNumber: number
) {
    let organization: Organization | undefined
    let category: Category | undefined
    let subcategory: Subcategory | undefined
    let subcategories: Subcategory[] = []
    const { organization_name, category_name, subcategory_name } = row

    try {
        if (!organization_name) {
            throw new Error('Organization name is not provided')
        }

        if (!category_name) {
            throw new Error('Category name is not provided')
        }

        organization = await manager.findOne(Organization, {
            where: { organization_name },
        })

        if (!organization) {
            throw new Error(
                `Provided organization with name ${organization_name} doesn't exists`
            )
        }

        if (subcategory_name) {
            subcategory = await manager.findOne(Subcategory, {
                where: { name: subcategory_name },
            })
        } else {
            subcategory = await Subcategory.findOneOrFail({
                where: {
                    name: 'None Specified',
                    system: true,
                    organization: null,
                },
            })
        }

        if (!subcategory) {
            throw new Error(
                `Provided subcategory with name ${subcategory_name} doesn't exists`
            )
        }

        category = await manager.findOne(Category, {
            where: {
                name: category_name,
                status: 'active',
                system: false,
                organization,
            },
        })

        if (category) {
            subcategories = (await category.subcategories) || []
            const subcategoryNames = subcategories.map(({ name }) => name)

            if (subcategoryNames.includes(subcategory_name)) {
                throw new Error(
                    `Provided subcategory with name ${subcategory_name} already exists for this category`
                )
            }
        } else {
            category = new Category()
            category.name = category_name
            category.organization = Promise.resolve(organization)
        }

        subcategories.push(subcategory)
        category.subcategories = Promise.resolve(subcategories)

        await manager.save(category)
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}
