import { EntityManager } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subject } from '../../entities/subject'
import { SubjectRow } from '../../types/csv/subjectRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from './errors/csvErrorConstants'

export async function processSubjectFromCSVRow(
    manager: EntityManager,
    row: SubjectRow,
    rowNumber: number,
    fileErrors: CSVError[]
) {
    if (!row.organization_name) {
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

    if (!row.subject_name) {
        addCsvError(
            fileErrors,
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
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const organizations = await manager.find(Organization, {
        where: { organization_name: row.organization_name },
    })

    if (!organizations || organizations.length != 1) {
        const organization_count = organizations ? organizations.length : 0
        addCsvError(
            fileErrors,
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

        return
    }

    const organization = organizations[0]

    const subjects = await manager.find(Subject, {
        where: {
            name: row.subject_name,
            organization: organization,
        },
    })

    let subject = new Subject()

    if (subjects) {
        if (subjects.length > 1) {
            addCsvError(
                fileErrors,
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

            return
        }

        if (subjects.length === 1) {
            subject = subjects[0]
        }
    }

    subject.name = row.subject_name
    subject.organization = Promise.resolve(organization)
    await manager.save(subject)

    const existingCategories = (await subject.categories) || []

    if (!row.category_name) {
        row.category_name = 'None Specified'
    }

    // does the category belong to organisation or a system category
    const categoryToAdd = await manager.findOne(Category, {
        where: [
            { name: row.category_name, organization: organization },
            { name: row.category_name, organization: null, system: true },
        ],
    })

    if (!categoryToAdd) {
        addCsvError(
            fileErrors,
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

        return
    }

    for (const p of existingCategories) {
        if (p.id === categoryToAdd.id) {
            addCsvError(
                fileErrors,
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

            return
        }
    }

    existingCategories.push(categoryToAdd)
    subject.categories = Promise.resolve(existingCategories)
    await manager.save(subject)
}
