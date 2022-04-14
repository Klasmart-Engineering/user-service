import { EntityManager } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { Program } from '../../entities/program'
import { Subject } from '../../entities/subject'
import { ProgramRow } from '../../types/csv/programRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import { validateAgeRanges } from './validations/ageRange'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processProgramFromCSVRow = async (
    manager: EntityManager,
    row: ProgramRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    let ageRange: AgeRange | undefined
    let grade: Grade | undefined
    let subject: Subject | undefined
    let program: Program | undefined
    let programAgeRanges: AgeRange[] = []
    let programGrades: Grade[] = []
    let programSubjects: Subject[] = []

    const {
        organization_name,
        program_name,
        age_range_high_value,
        age_range_low_value,
        age_range_unit,
        grade_name,
        subject_name,
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

    if (!program_name) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'program_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'program',
                attribute: 'name',
            }
        )
    }

    validateAgeRanges(
        rowErrors,
        rowNumber,
        age_range_low_value,
        age_range_high_value,
        age_range_unit
    )

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organization = await manager.findOne(Organization, {
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

    // Is the user authorized to upload programs to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
            PermissionName.create_program_20221
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'program',
                organizationName: organization.organization_name,
            }
        )
        return rowErrors
    }

    const ageRangeName = `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`
    if (!age_range_low_value && !age_range_high_value && !age_range_unit) {
        ageRange = await manager.findOneOrFail(AgeRange, {
            where: {
                name: 'None Specified',
                system: true,
                status: 'active',
                organization: null,
            },
        })
    } else {
        ageRange = await manager.findOne(AgeRange, {
            where: [
                {
                    name: ageRangeName,
                    low_value: age_range_low_value,
                    high_value: age_range_high_value,
                    high_value_unit: age_range_unit,
                    low_value_unit: age_range_unit,
                    system: false,
                    status: 'active',
                    organization,
                },
                {
                    name: ageRangeName,
                    low_value: age_range_low_value,
                    high_value: age_range_high_value,
                    high_value_unit: age_range_unit,
                    low_value_unit: age_range_unit,
                    system: true,
                    status: 'active',
                    organization: null,
                },
            ],
        })
    }

    if (!ageRange) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            rowNumber,
            'age_range_low_value, age_range_high_value, age_range_unit',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                entity: 'ageRange',
                name: ageRangeName,
                parent_entity: 'organization',
                parent_name: organization_name,
            }
        )
    }

    if (!grade_name) {
        grade = await manager.findOneOrFail(Grade, {
            where: {
                name: 'None Specified',
                system: true,
                status: 'active',
                organization: null,
            },
        })
    } else {
        grade = await manager.findOne(Grade, {
            where: {
                name: grade_name,
                system: false,
                status: 'active',
                organization,
            },
        })
    }

    if (!grade) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            rowNumber,
            'grade_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                entity: 'grade',
                name: grade_name,
                parent_entity: 'organization',
                parent_name: organization_name,
            }
        )
    }

    if (!subject_name) {
        subject = await manager.findOneOrFail(Subject, {
            where: {
                name: 'None Specified',
                system: true,
                status: 'active',
                organization: null,
            },
        })
    } else {
        subject = await manager.findOne(Subject, {
            where: {
                name: subject_name,
                system: false,
                status: 'active',
                organization,
            },
        })
    }

    if (!subject) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            rowNumber,
            'subject_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                entity: 'subject',
                name: subject_name,
                parent_entity: 'organization',
                parent_name: organization_name,
            }
        )
    }

    if (fileErrors.length > 0 || !ageRange || !grade || !subject) {
        return rowErrors
    }

    program = await manager.findOne(Program, {
        where: {
            name: program_name,
            system: false,
            status: 'active',
            organization,
        },
    })

    if (program) {
        programAgeRanges = (await program.age_ranges) || []
        const ageRangeNames = programAgeRanges.map(({ name }) => name)

        if (ageRangeNames.includes(ageRangeName)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'age_range_low_value, age_range_high_value, age_range_unit',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'ageRange',
                    name: ageRangeName,
                    parent_entity: 'program',
                    parent_name: program.name,
                }
            )

            return rowErrors
        }

        programGrades = (await program.grades) || []
        const gradeNames = programGrades.map(({ name }) => name)

        if (gradeNames.includes(grade_name)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'grade_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'grade',
                    name: grade_name,
                    parent_entity: 'program',
                    parent_name: program.name,
                }
            )

            return rowErrors
        }

        programSubjects = (await program.subjects) || []
        const subjectNames = programSubjects.map(({ name }) => name)

        if (subjectNames.includes(subject_name)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'subject_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'subject',
                    name: subject_name,
                    parent_entity: 'program',
                    parent_name: program.name,
                }
            )

            return rowErrors
        }
    } else {
        program = new Program()
        program.name = program_name
        program.organization = Promise.resolve(organization)
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    programAgeRanges.push(ageRange)
    programGrades.push(grade)
    programSubjects.push(subject)

    program.age_ranges = Promise.resolve(programAgeRanges)
    program.grades = Promise.resolve(programGrades)
    program.subjects = Promise.resolve(programSubjects)

    await manager.save(program)

    return rowErrors
}
