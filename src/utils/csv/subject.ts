import { EntityManager } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subject } from '../../entities/subject'
import { SubjectRow } from '../../types/csv/subjectRow'
import { saveError } from './readFile'

export async function processSubjectFromCSVRow(
    manager: EntityManager,
    row: SubjectRow,
    rowNumber: number,
    fileErrors: string[]
) {
    const requiredFieldsAreProvided = row.organization_name && row.subject_name

    if (!row.organization_name) {
        saveError(fileErrors, rowNumber, 'Mandatory Organization name is empty')
    }

    if (!row.subject_name) {
        saveError(fileErrors, rowNumber, 'Mandatory Subject name is empty')
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const organizations = await manager.find(Organization, {
        where: { organization_name: row.organization_name },
    })

    if (!organizations || organizations.length != 1) {
        const organization_count = organizations ? organizations.length : 0
        saveError(
            fileErrors,
            rowNumber,
            `Organizations name '${row.organization_name}' matches ${organization_count} Organizations, it should match one Organization`
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
            saveError(
                fileErrors,
                rowNumber,
                `subjects name '${row.subject_name}' already exists more than once in '${row.organization_name}'`
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
        saveError(
            fileErrors,
            rowNumber,
            `Category '${row.category_name}' not associated for Organisation '${row.organization_name}'`
        )
        return
    }

    for (const p of existingCategories) {
        if (p.id === categoryToAdd.id) {
            saveError(
                fileErrors,
                rowNumber,
                `Category '${row.category_name}' is already related to '${row.subject_name}'`
            )
            return
        }
    }

    existingCategories.push(categoryToAdd)
    subject.categories = Promise.resolve(existingCategories)
    await manager.save(subject)
}
