import { EntityManager } from 'typeorm'
import { GradeRow } from '../../types/csv/gradeRow'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'

interface OrganizationGradeIds {
    organization_id: string
    grade_id: string
}

export let organizationGradeIds: OrganizationGradeIds[] = []

async function findGradeInDatabaseOrTransaction(
    manager: EntityManager,
    organization: Organization,
    grade_name: string
) {
    return (
        (await Grade.findOne({
            where: {
                name: grade_name,
                system: false,
                status: 'active',
                organization: organization,
            },
        })) ||
        (await manager.findOne(Grade, {
            where: {
                name: grade_name,
                system: false,
                status: 'active',
                organization: organization,
            },
        }))
    )
}

export async function processGradeFromCSVRow(
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number
) {
    let grade: Grade | undefined
    let organization: Organization | undefined

    const { organization_name, grade_name } = row

    if (rowNumber === 1 && organizationGradeIds.length) {
        organizationGradeIds = []
    }

    try {
        if (!organization_name) {
            throw new Error('Organization name is not provided')
        }

        if (!grade_name) {
            throw new Error('Grade name is not provided')
        }

        organization = await Organization.findOne({
            where: { organization_name },
        })

        if (!organization) {
            throw new Error(
                `Organization with name '${organization_name}' doesn't exists`
            )
        }

        grade = await findGradeInDatabaseOrTransaction(
            manager,
            organization,
            grade_name
        )

        if (grade) {
            throw new Error(
                `Grade with name ${grade_name} can't be created because already exists in the organization with name ${organization_name}`
            )
        }

        grade = new Grade()
        grade.name = grade_name
        grade.organization = Promise.resolve(organization)
        grade.system = false

        await manager.save(grade)

        organizationGradeIds.push({
            organization_id: organization.organization_id,
            grade_id: grade.id,
        })
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}
