import { EntityManager } from 'typeorm'
import { GradeRow } from '../../types/csv/gradeRow'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { saveError } from './readFile'

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
    rowNumber: number,
    fileErrors: string[],
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
        saveError(fileErrors, rowNumber, notFoundErrorMessage)
    }

    return gradeFound
}

export async function processGradeFromCSVRow(
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number,
    fileErrors: string[]
) {
    const {
        organization_name,
        grade_name,
        progress_from_grade_name,
        progress_to_grade_name,
    } = row

    const requiredFieldsAreProvided = organization_name && grade_name

    if (!organization_name) {
        saveError(fileErrors, rowNumber, 'Organization name is not provided')
    }

    if (!grade_name) {
        saveError(fileErrors, rowNumber, 'Grade name is not provided')
    }

    // From grade should be different to grade
    if (progress_from_grade_name && progress_from_grade_name === grade_name) {
        saveError(
            fileErrors,
            rowNumber,
            "From grade name can't be the same as grade name"
        )
    }

    // To grade should be different to grade
    if (progress_to_grade_name && progress_to_grade_name === grade_name) {
        saveError(
            fileErrors,
            rowNumber,
            "To grade name can't be the same as grade name"
        )
    }

    // From and to grade should be different
    if (
        progress_from_grade_name &&
        progress_to_grade_name &&
        progress_from_grade_name === progress_to_grade_name
    ) {
        saveError(
            fileErrors,
            rowNumber,
            "From grade name and to grade name can't be the same"
        )
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const organization = await Organization.findOne({
        where: { organization_name },
    })

    if (!organization) {
        saveError(
            fileErrors,
            rowNumber,
            `Organization with name '${organization_name}' doesn't exists`
        )

        return
    }

    let grade = await findGradeInDatabaseOrTransaction(
        manager,
        organization,
        grade_name
    )

    if (grade) {
        saveError(
            fileErrors,
            rowNumber,
            `Grade with name '${grade_name}' can't be created because already exists in the organization with name '${organization_name}'`
        )

        return
    }

    grade = new Grade()
    grade.name = grade_name
    grade.organization = Promise.resolve(organization)
    grade.system = false

    await manager.save(grade)
}

export async function setGradeFromToFields(
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number,
    fileErrors: string[]
) {
    let toGrade: Grade | undefined
    let fromGrade: Grade | undefined

    const {
        organization_name,
        grade_name,
        progress_from_grade_name,
        progress_to_grade_name,
    } = row

    const organization = await Organization.findOne({
        where: { organization_name },
    })

    if (!organization) {
        return
    }

    if (progress_from_grade_name) {
        fromGrade = await findOrFailGradeInDatabaseOrTransaction(
            manager,
            organization,
            progress_from_grade_name,
            rowNumber,
            fileErrors,
            `Grade with name '${progress_from_grade_name}' can't be assigned as a from grade because this doesn't exists in organization with name '${organization_name}'`
        )
    } else {
        fromGrade = await Grade.findOneOrFail({
            where: {
                name: 'None Specified',
                system: true,
                organization: null,
            },
        })
    }

    if (progress_to_grade_name) {
        toGrade = await findOrFailGradeInDatabaseOrTransaction(
            manager,
            organization,
            progress_to_grade_name,
            rowNumber,
            fileErrors,
            `Grade with name '${progress_to_grade_name}' can't be assigned as a to grade because this doesn't exists in organization with name '${organization_name}'`
        )
    } else {
        toGrade = await Grade.findOneOrFail({
            where: {
                name: 'None Specified',
                system: true,
                organization: null,
            },
        })
    }

    if (!fromGrade || !toGrade) {
        return
    }

    const grade = await manager.findOneOrFail(Grade, {
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
}
