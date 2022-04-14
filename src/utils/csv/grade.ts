import { EntityManager } from 'typeorm'
import { GradeRow } from '../../types/csv/gradeRow'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'

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
    rowErrors: CSVError[],
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
            rowErrors,
            errCode,
            rowNumber,
            column,
            notFoundErrorMessage,
            params
        )
    }

    return gradeFound
}

export const processGradeFromCSVRow = async (
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    const {
        organization_name,
        grade_name,
        progress_from_grade_name,
        progress_to_grade_name,
    } = row

    if (!organization_name) {
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

    if (!grade_name) {
        addCsvError(
            rowErrors,
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
            rowErrors,
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
            rowErrors,
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
            rowErrors,
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
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organization = await Organization.findOne({
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )

        return rowErrors
    }

    let grade = await findGradeInDatabaseOrTransaction(
        manager,
        organization,
        grade_name
    )

    if (grade) {
        addCsvError(
            rowErrors,
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

        return rowErrors
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    grade = new Grade()
    grade.name = grade_name
    grade.organization = Promise.resolve(organization)
    grade.system = false

    await manager.save(grade)

    return rowErrors
}

export const setGradeFromToFields = async (
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    let toGrade: Grade | null
    let fromGrade: Grade | null

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
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )
        return rowErrors
    }

    if (progress_from_grade_name) {
        fromGrade = await findOrFailGradeInDatabaseOrTransaction(
            manager,
            organization,
            progress_from_grade_name,
            rowNumber,
            'progress_from_grade_name',
            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            rowErrors,
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
            rowErrors,
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

    // never save if there are any errors in the file
    if (
        fileErrors.length > 0 ||
        rowErrors.length > 0 ||
        !fromGrade ||
        !toGrade
    ) {
        return rowErrors
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

    return rowErrors
}
