import { EntityManager } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { Program } from '../../entities/program'
import { Subject } from '../../entities/subject'
import { ProgramRow } from '../../types/csv/programRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from './errors/csvErrorConstants'
import validationConstants from './validationConstants'

export async function processProgramFromCSVRow(
    manager: EntityManager,
    row: ProgramRow,
    rowNumber: number,
    fileErrors: CSVError[]
) {
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

    const allAgeRangeFieldsExists =
        age_range_high_value && age_range_low_value && age_range_unit
    const noneOfAgeRangeFieldsExists =
        !age_range_high_value && !age_range_low_value && !age_range_unit

    if (!organization_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_FIELD,
            rowNumber,
            "organization_name",
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                "entity": "organization",
                "attribute": "name",
            }
        )
    }

    if (!program_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_FIELD,
            rowNumber,
            "program_name",
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                "entity": "program",
                "attribute": "name",
            }
        )
    }

    if (!allAgeRangeFieldsExists && !noneOfAgeRangeFieldsExists) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "age_range_high_value, age_range_low_value, age_range_unit",
            "program must exist age_range_high_value, age_range_low_value, age_range_unit or none of them",
        )
    }

    const highValueNumber = Number(age_range_high_value)
    const lowValueNumber = Number(age_range_low_value)

    if (
        age_range_high_value &&
        (Number.isNaN(highValueNumber) ||
            !Number.isInteger(highValueNumber) ||
            highValueNumber < validationConstants.AGE_RANGE_HIGH_VALUE_MIN ||
            highValueNumber > validationConstants.AGE_RANGE_HIGH_VALUE_MAX)
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "age_range_high_value",
            csvErrorConstants.MSG_ERR_CSV_INVALID_BETWEEN,
            {
                "entity": "ageRange",
                "attribute": "age_range_high_value",
                "min": validationConstants.AGE_RANGE_LOW_VALUE_MIN,
                "max": validationConstants.AGE_RANGE_LOW_VALUE_MAX,
            }
        )
    }

    if (
        age_range_low_value &&
        (Number.isNaN(lowValueNumber) ||
            !Number.isInteger(lowValueNumber) ||
            lowValueNumber < validationConstants.AGE_RANGE_LOW_VALUE_MIN ||
            lowValueNumber > validationConstants.AGE_RANGE_LOW_VALUE_MAX)
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "age_range_low_value",
            csvErrorConstants.MSG_ERR_CSV_INVALID_BETWEEN,
            {
                "entity": "ageRange",
                "attribute": "age_range_low_value",
                "min": validationConstants.AGE_RANGE_LOW_VALUE_MIN,
                "max": validationConstants.AGE_RANGE_LOW_VALUE_MAX,
            }
        )
    }

    if (
        age_range_low_value &&
        age_range_high_value &&
        lowValueNumber >= highValueNumber
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "age_range_low_value",
            csvErrorConstants.MSG_ERR_CSV_INVALID_GREATER_THAN_OTHER,
            {
                "entity": "ageRange",
                "attribute": "age_range_high_value",
                "other": "age_range_low_value",
            }
        )
    }

    if (
        age_range_unit &&
        age_range_unit !== AgeRangeUnit.MONTH &&
        age_range_unit !== AgeRangeUnit.YEAR
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "age_range_low_value",
            csvErrorConstants.MSG_ERR_CSV_INVALID_ENUM,
            {
                "entity": "ageRange",
                "attribute": "age_range_unit",
                "values": "month, year",
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
            rowNumber,
            "organization_name",
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                "name": organization_name,
                "entity": "organization",
            }
        )

        return
    }

    if (noneOfAgeRangeFieldsExists) {
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
            where: {
                name: `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`,
                low_value: age_range_low_value,
                high_value: age_range_high_value,
                high_value_unit: age_range_unit,
                low_value_unit: age_range_unit,
                system: false,
                status: 'active',
                organization,
            },
        })
    }

    if (!ageRange) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
            rowNumber,
            "age_range_low_value, age_range_high_value, age_range_unit",
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                "entity": "ageRange",
                "name": `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`,
                "parent_entity": "organization",
                "parent_name": organization_name,
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
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
            rowNumber,
            "grade_name",
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                "entity": "grade",
                "name": grade_name,
                "parent_entity": "organization",
                "parent_name": organization_name,
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
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
            rowNumber,
            "subject_name",
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                "entity": "subject",
                "name": subject_name,
                "parent_entity": "organization",
                "parent_name": organization_name,
            }
        )
    }

    if (fileErrors && fileErrors.length > 0 || !ageRange || !grade || !subject) {
        return
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

        if (
            ageRangeNames.includes(
                `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`
            )
        ) {
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
                rowNumber,
                "age_range_low_value, age_range_high_value, age_range_unit",
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    "entity": "ageRange",
                    "name": `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`,
                    "parent_entity": "program",
                    "parent_name": program.name,
                }
            )

            return
        }

        programGrades = (await program.grades) || []
        const gradeNames = programGrades.map(({ name }) => name)

        if (gradeNames.includes(grade_name)) {
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
                rowNumber,
                "grade_name",
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    "entity": "grade",
                    "name": grade_name,
                    "parent_entity": "program",
                    "parent_name": program.name,
                }
            )

            return
        }

        programSubjects = (await program.subjects) || []
        const subjectNames = programSubjects.map(({ name }) => name)

        if (subjectNames.includes(subject_name)) {
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
                rowNumber,
                "subject_name",
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    "entity": "grade",
                    "name": subject_name,
                    "parent_entity": "program",
                    "parent_name": program.name,
                }
            )

            return
        }
    } else {
        program = new Program()
        program.name = program_name
        program.organization = Promise.resolve(organization)
    }

    programAgeRanges.push(ageRange)
    programGrades.push(grade)
    programSubjects.push(subject)

    program.age_ranges = Promise.resolve(programAgeRanges)
    program.grades = Promise.resolve(programGrades)
    program.subjects = Promise.resolve(programSubjects)

    await manager.save(program)
}
