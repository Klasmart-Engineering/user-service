import { EntityManager } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { CategoryRow } from '../../types/csv/categoryRow'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import csvErrorConstants from './errors/csvErrorConstants'

export async function processCategoryFromCSVRow(
    manager: EntityManager,
    row: CategoryRow,
    rowNumber: number,
    fileErrors: CSVError[]
) {
    let category: Category | undefined
    let subcategory: Subcategory | undefined
    let subcategories: Subcategory[] = []
    const { organization_name, category_name, subcategory_name } = row

    if (!organization_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!category_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'category_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'category',
                attribute: 'name',
            }
        )
    }

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
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
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'subcategory_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: subcategory_name,
                entity: 'subCategory',
            }
        )
    }

    if (
        (fileErrors && fileErrors.length > 0) ||
        !organization ||
        !subcategory
    ) {
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
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'subcategory_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    name: subcategory_name,
                    entity: 'subCategory',
                    parent_name: category_name,
                    parent_entity: 'category',
                }
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
