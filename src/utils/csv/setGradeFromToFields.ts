import { EntityManager } from 'typeorm'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { GradeRow } from '../../types/csv/gradeRow'

let noneSpecifiedGrade: Grade | undefined = undefined

async function findOrFailGradeInDatabaseOrTransaction(
    manager: EntityManager,
    organization: Organization,
    grade_name: string,
    notFoundErrorMessage: string
) {
    let gradeFound =
        (await Grade.findOne({
            where: {
                name: grade_name,
                system: false,
                status: 'active',
                organization,
            },
        })) ||
        (await manager.findOne(Grade, {
            where: {
                name: grade_name,
                system: false,
                status: 'active',
                organization,
            },
        }))

    if (!gradeFound) {
        throw new Error(notFoundErrorMessage)
    }

    return gradeFound
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
