import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { SubCategoryRow } from '../../types/csv/subCategoryRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processSubCategoriesFromCSVRow = async (
    manager: EntityManager,
    { organization_name, subcategory_name }: SubCategoryRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    if (!organization_name) {
        addCsvError(
            rowErrors,
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

    if (!subcategory_name) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'subcategory_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'subCategory',
                attribute: 'name',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const org = await Organization.findOne({ organization_name })

    if (!org) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                entity: 'organization',
                name: organization_name,
            }
        )

        return rowErrors
    }

    // Is the user authorized to upload subcategories to this org
    // Uses create-subjects permission in line with existing related root-level mutations
    if (
        !(await userPermissions.allowed(
            { organization_ids: [org.organization_id] },
            PermissionName.create_subjects_20227
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'subcategory',
                organizationName: org.organization_name,
            }
        )
        return rowErrors
    }

    const subCategoryExists = await manager.findOne(Subcategory, {
        where: { name: subcategory_name, organization: org },
    })

    if (subCategoryExists) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
            rowNumber,
            'subcategory_name',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                entity: 'subCategory',
                name: subcategory_name,
                parent_entity: 'organization',
                parent_name: organization_name,
            }
        )

        return rowErrors
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    const s = new Subcategory()
    s.organization = Promise.resolve(org)
    s.name = subcategory_name
    await manager.save(s)

    return rowErrors
}
