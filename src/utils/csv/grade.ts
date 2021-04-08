import { EntityManager } from 'typeorm'
import { GradeRow } from '../../types/csv/gradeRow'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'

let noneSpecifiedGrade: Grade | undefined = undefined

function findGradeInDatabaseOrTransaction(
    manager: EntityManager,
    organization: Organization,
    grade_name: string
) {
    return manager.findOne(Grade, {
        where: {
            name: grade_name,
            system: false,
            status: 'active',
            organization: organization,
        },
    })
}

async function findOrFailGradeInDatabaseOrTransaction(
    manager: EntityManager,
    organization: Organization,
    grade_name: string,
    notFoundErrorMessage: string
) {
    const gradeFound = await manager.findOne(Grade, {
        where: {
            name: grade_name,
            system: false,
            status: 'active',
            organization,
        },
    })

    if (!gradeFound) {
        throw new Error(notFoundErrorMessage)
    }

    return gradeFound
}

export async function processGradeFromCSVRow(
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number
) {
    let grade: Grade | undefined
    let organization: Organization | undefined

    const {
        organization_name,
        grade_name,
        progress_from_grade_name,
        progress_to_grade_name,
    } = row

    try {
        if (!organization_name) {
            throw new Error('Organization name is not provided')
        }

        if (!grade_name) {
            throw new Error('Grade name is not provided')
        }

        // From grade should be different to grade
        if (
            progress_from_grade_name &&
            progress_from_grade_name === grade_name
        ) {
            throw new Error("From grade name can't be the same as grade name")
        }

        // To grade should be different to grade
        if (progress_to_grade_name && progress_to_grade_name === grade_name) {
            throw new Error("To grade name can't be the same as grade name")
        }

        // From and to grade should be different
        if (
            progress_from_grade_name &&
            progress_to_grade_name &&
            progress_from_grade_name === progress_to_grade_name
        ) {
            throw new Error(
                "From grade name and to grade name can't be the same"
            )
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
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}

export async function setGradeFromToFields(
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number
) {
    let grade: Grade
    let organization: Organization
    let toGrade: Grade
    let fromGrade: Grade

    const {
        organization_name,
        grade_name,
        progress_from_grade_name,
        progress_to_grade_name,
    } = row

    try {
        if (!noneSpecifiedGrade) {
            noneSpecifiedGrade = await Grade.findOneOrFail({
                where: {
                    name: 'None Specified',
                    system: true,
                    organization: null,
                },
            })
        }

        organization = await Organization.findOneOrFail({
            where: { organization_name },
        })

        if (progress_from_grade_name) {
            fromGrade = await findOrFailGradeInDatabaseOrTransaction(
                manager,
                organization,
                progress_from_grade_name,
                `Grade with name '${progress_from_grade_name}' can't be assigned as a from grade because this doesn't exists in organization with name '${organization_name}'`
            )
        } else {
            fromGrade = noneSpecifiedGrade
        }

        if (progress_to_grade_name) {
            toGrade = await findOrFailGradeInDatabaseOrTransaction(
                manager,
                organization,
                progress_to_grade_name,
                `Grade with name '${progress_to_grade_name}' can't be assigned as a to grade because this doesn't exists in organization with name '${organization_name}'`
            )
        } else {
            toGrade = noneSpecifiedGrade
        }

        grade = await manager.findOneOrFail(Grade, {
            where: {
                name: grade_name,
                system: false,
                status: 'active',
                organization: organization,
            },
        })

        grade.progress_from_grade = Promise.resolve(fromGrade)
        grade.progress_to_grade = Promise.resolve(toGrade)

        await manager.save(grade)
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}
