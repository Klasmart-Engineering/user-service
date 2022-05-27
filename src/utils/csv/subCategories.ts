import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { SubCategoryRow } from '../../types/csv/subCategoryRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
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
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'organization_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!subcategory_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'subcategory_name',
            customErrors.missing_required_entity_attribute.message,
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

    const org = await Organization.findOneBy({ organization_name })

    if (!org) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entity: 'organization',
                entityName: organization_name,
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
        where: {
            name: subcategory_name,
            organization: { organization_id: org.organization_id },
        },
    })

    if (subCategoryExists) {
        addCsvError(
            rowErrors,
            customErrors.existent_child_entity.code,
            rowNumber,
            'subcategory_name',
            customErrors.existent_child_entity.message,
            {
                entity: 'subCategory',
                entityName: subcategory_name,
                parentEntity: 'organization',
                parentName: organization_name,
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
