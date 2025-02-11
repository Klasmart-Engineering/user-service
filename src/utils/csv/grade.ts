import { EntityManager, IsNull } from 'typeorm'
import { GradeRow } from '../../types/csv/gradeRow'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import { Status } from '../../entities/status'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

function findGradeInDatabaseOrTransaction(
    manager: EntityManager,
    organization: Organization,
    grade_name: string
) {
    return manager.findOne(Grade, {
        where: {
            name: grade_name,
            system: false,
            status: Status.ACTIVE,
            organization: { organization_id: organization.organization_id },
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
            status: Status.ACTIVE,
            organization: { organization_id: organization.organization_id },
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
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'organization_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!grade_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'grade_name',
            customErrors.missing_required_entity_attribute.message,
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
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entityName: organization_name,
                entity: 'organization',
            }
        )

        return rowErrors
    }

    // Is the user authorized to upload grades to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
            PermissionName.create_grade_20223
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'grade',
                organizationName: organization.organization_name,
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
            customErrors.existent_child_entity.code,
            rowNumber,
            'grade_name',
            customErrors.existent_child_entity.message,
            {
                entityName: grade_name,
                entity: 'grade',
                parentName: organization_name,
                parentEntity: 'organization',
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
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entityName: organization_name,
                entity: 'organization',
            }
        )
        return rowErrors
    }

    // Is the user authorized to upload grades to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
            PermissionName.create_grade_20223
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'grade',
                organizationName: organization.organization_name,
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
            customErrors.nonexistent_child.code,
            rowErrors,
            customErrors.nonexistent_entity.message,
            {
                entityName: progress_from_grade_name,
                entity: 'grade',
                parentName: organization_name,
                parentEntity: 'organization',
            }
        )
    } else {
        fromGrade = await Grade.findOneOrFail({
            where: {
                name: 'None Specified',
                system: true,
                organization: IsNull(),
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
            customErrors.nonexistent_child.code,
            rowErrors,
            customErrors.nonexistent_child.message,
            {
                entityName: progress_to_grade_name,
                entity: 'grade',
                parentName: organization_name,
                parentEntity: 'organization',
            }
        )
    } else {
        toGrade = await Grade.findOneOrFail({
            where: {
                name: 'None Specified',
                system: true,
                organization: IsNull(),
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
            status: Status.ACTIVE,
            organization: { organization_id: organization.organization_id },
        },
    })

    grade.progress_from_grade = Promise.resolve(fromGrade)
    grade.progress_to_grade = Promise.resolve(toGrade)

    await manager.save(grade)

    return rowErrors
}
