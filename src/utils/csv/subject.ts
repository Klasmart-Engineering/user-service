import { EntityManager } from 'typeorm'
import { Category } from '../../entities/category'
import { Organization } from '../../entities/organization'
import { Subject } from '../../entities/subject'
import { SubjectRow } from '../../types/csv/subjectRow'

export async function processSubjectFromCSVRow(
    manager: EntityManager,
    row: SubjectRow,
    rowNumber: number
) {
    try {
        if (!row.organization_name) {
            throw new Error(`Mandatory Organization name is empty`)
        }

        if (!row.subject_name) {
            throw new Error(`Mandatory Subject name is empty`)
        }

        const organizations = await manager.find(Organization, {
            where: { organization_name: row.organization_name },
        })

        if (!organizations || organizations.length != 1) {
            const organization_count = organizations ? organizations.length : 0
            throw new Error(
                `Organizations name '${row.organization_name}' matches ${organization_count} Organizations, it should match one Organization`
            )
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
                throw new Error(
                    `subjects name '${row.subject_name}' already exists more than once in '${row.organization_name}'`
                )
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
            throw new Error(
                `Category '${row.category_name}' not associated for Organisation ${row.organization_name}`
            )
        }
        for (const p of existingCategories) {
            if (p.id === categoryToAdd.id) {
                throw new Error(
                    `Category '${row.category_name}' is already related to '${row.subject_name}'`
                )
            }
        }
        existingCategories.push(categoryToAdd)
        subject.categories = Promise.resolve(existingCategories)
        await manager.save(subject)
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}
