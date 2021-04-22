import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { SubCategoryRow } from '../../types/csv/subCategoryRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from './errors/csvErrorConstants'

export const processSubCategoriesFromCSVRow = async (
    manager: EntityManager,
    { organization_name, subcategory_name }: SubCategoryRow,
    rowNumber: number,
    fileErrors: CSVError[]
) => {
    if (!organization_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_FIELD,
            rowNumber,
            "organization_name",
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                "entity": "organization",
                "attribute": "name",
            }
        )
    }

    if (!subcategory_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_FIELD,
            rowNumber,
            "subcategory_name",
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                "entity": "subCategory",
                "attribute": "name",
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const org = await Organization.findOne({ organization_name })

    if (!org) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
            rowNumber,
            "organization_name",
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                "entity": "organization",
                "name": organization_name,
            }
        )

        return
    }

    const subCategoryExists = await manager.findOne(Subcategory, {
        where: { name: subcategory_name, organization: org },
    })

    if (subCategoryExists) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
            rowNumber,
            "subcategory_name",
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                "entity": "subCategory",
                "name": subcategory_name,
                "parent_entity": "organization",
                "parent_name": organization_name,
            }
        )

        return
    }

    const s = new Subcategory()
    s.organization = Promise.resolve(org)
    s.name = subcategory_name
    await manager.save(s)
}
