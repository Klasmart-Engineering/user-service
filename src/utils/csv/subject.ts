import { Brackets, EntityManager } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subject } from '../../entities/subject'
import { SubjectRow } from '../../types/csv/subjectRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processSubjectFromCSVRow = async (
    manager: EntityManager,
    row: SubjectRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    if (!row.organization_name) {
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

    if (!row.subject_name) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'subject_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'subject',
                attribute: 'name',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organizations = await manager.find(Organization, {
        where: { organization_name: row.organization_name },
    })

    if (!organizations || organizations.length != 1) {
        const organization_count = organizations ? organizations.length : 0
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_MULTIPLE_EXIST,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_MULTIPLE_EXIST,
            {
                entity: 'organization',
                name: row.organization_name,
                count: organization_count,
            }
        )

        return rowErrors
    }

    const organization = organizations[0]

    // Is the user authorized to upload subjects to this org
    // Uses create-subjects permission in line with existing related root-level mutations
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
                entity: 'subject',
                organizationName: organization.organization_name,
            }
        )
        return rowErrors
    }

    const subjects = await manager.find(Subject, {
        where: {
            name: row.subject_name,
            organization: { organization_id: organization.organization_id },
        },
    })

    let subject = new Subject()

    if (subjects) {
        if (subjects.length > 1) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD,
                rowNumber,
                'subject_name',
                csvErrorConstants.MSG_ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD,
                {
                    entity: 'subject',
                    name: row.subject_name,
                    parent_entity: 'organization',
                    parent_name: row.organization_name,
                }
            )

            return rowErrors
        }

        if (subjects.length === 1) {
            subject = subjects[0]
        }
    }

    subject.name = row.subject_name
    subject.organization = Promise.resolve(organization)

    const existingCategories = (await subject.categories) || []

    if (!row.category_name) {
        row.category_name = 'None Specified'
    }

    // does the category belong to organisation or a system category
    const categoryToAdd = await Category.createQueryBuilder('Category')
        .leftJoin('Category.organization', 'Organization')
        .where('name = :categoryName', { categoryName: row.category_name })
        .andWhere(
            new Brackets((qb) => {
                qb.where('Organization.organization_id = :organizationId', {
                    organizationId: organization.organization_id,
                }).orWhere(
                    new Brackets((qb) => {
                        qb.where('system = true').andWhere(
                            'Organization.organization_id IS NULL'
                        )
                    })
                )
            })
        )
        .getOne()

    if (!categoryToAdd) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            rowNumber,
            'category_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                entity: 'category',
                name: row.category_name,
                parent_entity: 'organization',
                parent_name: row.organization_name,
            }
        )

        return rowErrors
    }

    for (const p of existingCategories) {
        if (p.id === categoryToAdd.id) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'category_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'category',
                    name: row.category_name,
                    parent_entity: 'subject',
                    parent_name: row.subject_name,
                }
            )

            return rowErrors
        }
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    existingCategories.push(categoryToAdd)
    subject.categories = Promise.resolve(existingCategories)
    await manager.save(subject)

    return rowErrors
}
