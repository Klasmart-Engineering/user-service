import { EntityManager, IsNull } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { CategoryRow } from '../../types/csv/categoryRow'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import { UserPermissions } from '../../permissions/userPermissions'
import { Status } from '../../entities/status'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processCategoryFromCSVRow = async (
    manager: EntityManager,
    row: CategoryRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    let category: Category | null
    let subcategory: Subcategory | null
    let subcategories: Subcategory[] = []
    const { organization_name, category_name, subcategory_name } = row

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

    if (!category_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'category_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'category',
                attribute: 'name',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entityName: organization_name,
                entity: 'organization',
            }
        )
        return rowErrors
    }

    // Is the user authorized to upload categories to this org
    // Uses create-subjects permission in line with CreateCategories root-level mutations due to no other available precedent
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
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
                entity: 'category',
                organizationName: organization.organization_name,
            }
        )
        return rowErrors
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
                organization: IsNull(),
            },
        })
    }

    if (!subcategory) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'subcategory_name',
            customErrors.nonexistent_entity.message,
            {
                entityName: subcategory_name,
                entity: 'subCategory',
            }
        )
    }

    if (rowErrors.length > 0 || !organization || !subcategory) {
        return rowErrors
    }

    category = await manager.findOne(Category, {
        where: {
            name: category_name,
            status: Status.ACTIVE,
            system: false,
            organization: { organization_id: organization.organization_id },
        },
    })

    if (category) {
        subcategories = (await category.subcategories) || []
        const subcategoryNames = subcategories.map(({ name }) => name)

        if (subcategoryNames.includes(subcategory_name)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'subcategory_name',
                customErrors.existent_child_entity.message,
                {
                    entityName: subcategory_name,
                    entity: 'subCategory',
                    parentName: category_name,
                    parentEntity: 'category',
                }
            )

            return rowErrors
        }
    } else {
        category = new Category()
        category.name = category_name
        category.organization = Promise.resolve(organization)
    }

    subcategories.push(subcategory)
    category.subcategories = Promise.resolve(subcategories)

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    await manager.save(category)

    return rowErrors
}
