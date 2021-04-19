import { EntityManager } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { CategoryRow } from '../../types/csv/categoryRow'
import { saveError } from './readFile'

export async function processCategoryFromCSVRow(
    manager: EntityManager,
    row: CategoryRow,
    rowNumber: number,
    fileErrors: string[]
) {
    let category: Category | undefined
    let subcategory: Subcategory | undefined
    let subcategories: Subcategory[] = []
    const { organization_name, category_name, subcategory_name } = row
    const requiredFieldsAreProvided = organization_name && category_name

    if (!organization_name) {
        saveError(fileErrors, rowNumber, 'Organization name is not provided')
    }

    if (!category_name) {
        saveError(fileErrors, rowNumber, 'Category name is not provided')
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
        saveError(
            fileErrors,
            rowNumber,
            `Provided organization with name '${organization_name}' doesn't exists`
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
        saveError(
            fileErrors,
            rowNumber,
            `Provided subcategory with name '${subcategory_name}' doesn't exists`
        )
    }

    if (!organization || !subcategory) {
        return
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
            saveError(
                fileErrors,
                rowNumber,
                `Provided subcategory with name '${subcategory_name}' already exists for this category`
            )

            return
        }
    } else {
        category = new Category()
        category.name = category_name
        category.organization = Promise.resolve(organization)
    }

    subcategories.push(subcategory)
    category.subcategories = Promise.resolve(subcategories)

    await manager.save(category)
}
