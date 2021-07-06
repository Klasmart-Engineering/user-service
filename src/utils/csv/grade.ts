import { EntityManager } from 'typeorm'
import { GradeRow } from '../../types/csv/gradeRow'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'

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
    column: string,
    errCode: string,
    fileErrors: CSVError[],
    notFoundErrorMessage: string,
    params: Record<string, unknown>
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
        addCsvError(
            fileErrors,
            errCode,
            rowNumber,
            column,
            notFoundErrorMessage,
            params
        )
    }

    return gradeFound
}

export async function processGradeFromCSVRow(
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number,
    fileErrors: CSVError[]
) {
    const {
        organization_name,
        grade_name,
        progress_from_grade_name,
        progress_to_grade_name,
    } = row

    if (!organization_name) {
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

    if (!grade_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'grade_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'grade',
                attribute: 'name',
            }
        )
    }

    // From grade should be different to grade
    if (progress_from_grade_name && progress_from_grade_name === grade_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_DIFFERENT,
            rowNumber,
            'progress_from_grade_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_DIFFERENT,
            {
                entity: 'grade',
                attribute: 'progress_from_grade_name',
                other: 'name',
            }
        )
    }

    // To grade should be different to grade
    if (progress_to_grade_name && progress_to_grade_name === grade_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_DIFFERENT,
            rowNumber,
            'progress_to_grade_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_DIFFERENT,
            {
                entity: 'grade',
                attribute: 'progress_to_grade_name',
                other: 'name',
            }
        )
    }

    // From and to grade should be different
    if (
        progress_from_grade_name &&
        progress_to_grade_name &&
        progress_from_grade_name === progress_to_grade_name
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_DIFFERENT,
            rowNumber,
            'progress_to_grade_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_DIFFERENT,
            {
                entity: 'grade',
                attribute: 'progress_to_grade_name',
                other: 'progress_from_grade_name',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const organization = await Organization.findOne({
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )

        return
    }

    let grade = await findGradeInDatabaseOrTransaction(
        manager,
        organization,
        grade_name
    )

    if (grade) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
            rowNumber,
            'grade_name',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                name: grade_name,
                entity: 'grade',
                parent_name: organization_name,
                parent_entity: 'organization',
            }
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
    fileErrors: CSVError[]
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
            'progress_from_grade_name',
            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            fileErrors,
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                name: progress_from_grade_name,
                entity: 'grade',
                parent_name: organization_name,
                parent_entity: 'organization',
            }
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
            'progress_to_grade_name',
            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            fileErrors,
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                name: progress_to_grade_name,
                entity: 'grade',
                parent_name: organization_name,
                parent_entity: 'organization',
            }
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
