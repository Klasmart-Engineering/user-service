import { EntityManager, Not } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Class } from '../../entities/class'
import { School } from '../../entities/school'
import { Program } from '../../entities/program'
import { Grade } from '../../entities/grade'
import {
    generateShortCode,
    SHORTCODE_DEFAULT_MAXLEN,
    validateShortCode,
} from '../shortcode'
import { ClassRow } from '../../types/csv/classRow'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import { config } from '../../config/config'
import { REGEX } from '../../entities/validations/regex'
import { customErrors } from '../../types/errors/customError'
import { Subject } from '../../entities/subject'
import { validateAgeRanges } from './validations/ageRange'
import { AgeRange } from '../../entities/ageRange'
import { PermissionName } from '../../permissions/permissionNames'
import { AcademicTerm } from '../../entities/academicTerm'

export const processClassFromCSVRow = async (
    manager: EntityManager,
    {
        organization_name,
        class_name,
        class_shortcode,
        school_name,
        program_name,
        grade_name,
        subject_name,
        age_range_low_value,
        age_range_high_value,
        age_range_unit,
        academic_term_name,
    }: ClassRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
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

    if (!class_name) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'class_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'class',
                attribute: 'name',
            }
        )
    }

    if (class_name?.length > config.limits.CLASS_NAME_MAX_LENGTH) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_LENGTH,
            rowNumber,
            'class_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_LENGTH,
            {
                entity: 'class',
                attribute: 'name',
                max: config.limits.CLASS_NAME_MAX_LENGTH,
            }
        )
    }

    if (
        class_name &&
        !class_name.match(REGEX.alphanum_with_special_characters)
    ) {
        addCsvError(
            rowErrors,
            customErrors.invalid_alphanumeric_special.code,
            rowNumber,
            'class_name',
            customErrors.invalid_alphanumeric_special.message,
            {
                entity: 'class',
                attribute: 'name',
            }
        )
    }

    if (
        class_shortcode &&
        !validateShortCode(class_shortcode, SHORTCODE_DEFAULT_MAXLEN)
    ) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
            rowNumber,
            'class_shortcode',
            csvErrorConstants.MSG_ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
            {
                entity: 'class',
                attribute: 'shortcode',
                max: SHORTCODE_DEFAULT_MAXLEN,
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

    const org = await Organization.findOne({ organization_name })

    if (!org) {
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

    // Is the user authorized to upload classes to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [org.organization_id] },
            PermissionName.create_class_20224
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'class',
                organizationName: org.organization_name,
            }
        )
        return rowErrors
    }

    const classInDatabase = await Class.findOne({
        where: { organization: org, class_name },
    })

    if (classInDatabase) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
            rowNumber,
            'class_name',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_ENTITY,
            {
                name: class_name,
                entity: 'class',
            }
        )

        return rowErrors
    }

    const classExist = await manager.findOne(Class, {
        where: {
            shortcode: class_shortcode,
            organization: org,
            class_name: Not(class_name),
        },
    })

    if (class_shortcode && classExist) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
            rowNumber,
            'class_shortcode',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                name: class_shortcode,
                entity: 'shortcode',
                parent_name: classExist.class_name,
                parent_entity: 'class',
            }
        )

        return rowErrors
    }

    // check if class exists in manager
    const classInManager = await manager.findOne(Class, {
        where: { class_name, organization: org },
    })

    let c
    if (classInManager) {
        c = classInManager
    } else {
        c = new Class()
        c.class_name = class_name
        c.shortcode = class_shortcode || generateShortCode(class_name)
        c.organization = Promise.resolve(org)
    }

    const existingSchools = (await c.schools) || []
    if (school_name) {
        const school = await School.findOne({
            where: { school_name, organization: org },
        })

        if (!school) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                rowNumber,
                'school_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                {
                    name: school_name,
                    entity: 'school',
                    parent_name: organization_name,
                    parent_entity: 'organization',
                }
            )

            return rowErrors
        }

        const existingSchoolNames = existingSchools.map((s) => s.school_name)

        if (existingSchoolNames.includes(school_name)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'school_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    name: school_name,
                    entity: 'school',
                    parent_name: class_name,
                    parent_entity: 'class',
                }
            )

            return rowErrors
        }

        existingSchools.push(school)
    }

    if (academic_term_name) {
        const academicTerm = await AcademicTerm.findOne({
            name: academic_term_name,
        })
        if (!academicTerm) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
                rowNumber,
                'academic_term_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
                {
                    name: academic_term_name,
                    entity: 'AcademicTerm',
                }
            )
        }
        if (existingSchools.length !== 1) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_MUST_HAVE_EXACTLY_N,
                rowNumber,
                'school_name',
                csvErrorConstants.MSG_ERR_CSV_MUST_HAVE_EXACTLY_N,
                {
                    entityName: class_name,
                    entity: 'Class',
                    count: 1,
                    parentEntity: 'School',
                }
            )
        } else if (academicTerm) {
            if (existingSchools[0].school_id !== academicTerm.school_id) {
                addCsvError(
                    rowErrors,
                    csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                    rowNumber,
                    'academic_term_name',
                    csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                    {
                        name: academic_term_name,
                        entity: 'AcademicTerm',
                        parent_name: school_name,
                        parent_entity: 'School',
                    }
                )
            }
            c.academicTerm = Promise.resolve(academicTerm)
        }
        if (rowErrors.length > 0) {
            return rowErrors
        }
    }

    c.schools = Promise.resolve(existingSchools)

    const existingPrograms = (await c.programs) || []
    let programToAdd
    if (program_name) {
        // does the program belong to organisation or a system program
        programToAdd = await Program.findOne({
            where: [
                { name: program_name, organization: org },
                { name: program_name, organization: null, system: true },
            ],
        })

        if (!programToAdd) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                rowNumber,
                'program_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                {
                    name: program_name,
                    entity: 'program',
                    parent_name: organization_name,
                    parent_entity: 'organization',
                }
            )

            return rowErrors
        }

        const existingProgramNames = existingPrograms.map(
            (program) => program.name
        )

        if (existingProgramNames.includes(program_name)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'program_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    name: program_name,
                    entity: 'program',
                    parent_name: class_name,
                    parent_entity: 'class',
                }
            )
            return rowErrors
        }

        existingPrograms.push(programToAdd)
    } else {
        // get program with none specified
        programToAdd = await Program.findOne({
            where: { name: 'None Specified' },
        })

        if (programToAdd) {
            existingPrograms.push(programToAdd)
        }
    }
    c.programs = Promise.resolve(existingPrograms)

    const existingGrades = (await c.grades) || []
    if (grade_name) {
        // does the grade belong to organisation or a system grade
        const gradeToAdd = await Grade.findOne({
            where: [
                { name: grade_name, organization: org },
                { name: grade_name, organization: null, system: true },
            ],
        })

        if (!gradeToAdd) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                rowNumber,
                'grade_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                {
                    name: grade_name,
                    entity: 'grade',
                    parent_name: organization_name,
                    parent_entity: 'organization',
                }
            )

            return rowErrors
        }

        const existingGradeNames = existingGrades.map((grade) => grade.name)

        if (existingGradeNames.includes(grade_name)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'grade_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    name: grade_name,
                    entity: 'grade',
                    parent_name: class_name,
                    parent_entity: 'class',
                }
            )
            return rowErrors
        }

        existingGrades.push(gradeToAdd)
    }
    if (existingGrades.length) c.grades = Promise.resolve(existingGrades)

    const existingSubjects = (await c.subjects) || []
    if (subject_name) {
        // does the subject belong to organisation or a system subject
        const subjectToAdd = await Subject.findOne({
            where: [
                { name: subject_name, organization: org },
                { name: subject_name, organization: null, system: true },
            ],
        })

        if (!subjectToAdd) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                rowNumber,
                'subject_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                {
                    name: subject_name,
                    entity: 'subject',
                    parent_name: organization_name,
                    parent_entity: 'organization',
                }
            )

            return rowErrors
        }

        const existingSubjectNames = existingSubjects.map((s) => s.name)

        if (existingSubjectNames.includes(subject_name)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'subject_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    name: subject_name,
                    entity: 'subject',
                    parent_name: class_name,
                    parent_entity: 'class',
                }
            )
            return rowErrors
        }

        existingSubjects.push(subjectToAdd)
    }
    if (existingSubjects.length) c.subjects = Promise.resolve(existingSubjects)

    const existingAgeRanges = (await c.age_ranges) || []
    if (age_range_low_value && age_range_high_value && age_range_unit) {
        const ageRangeName = `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`

        // does the age range belong to organisation or a system age range
        const ageRangeToAdd = await AgeRange.findOne({
            where: [
                {
                    name: ageRangeName,
                    low_value: age_range_low_value,
                    high_value: age_range_high_value,
                    high_value_unit: age_range_unit,
                    low_value_unit: age_range_unit,
                    system: false,
                    status: 'active',
                    organization: org,
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

        if (!ageRangeToAdd) {
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
            return rowErrors
        }

        const existingAgeRangeNames = existingAgeRanges.map((ar) => ar.name)

        if (existingAgeRangeNames.includes(ageRangeName)) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'age_range_low_value, age_range_high_value, age_range_unit',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'ageRange',
                    name: ageRangeName,
                    parent_entity: 'class',
                    parent_name: class_name,
                }
            )
            return rowErrors
        }

        existingAgeRanges.push(ageRangeToAdd)
    }
    if (existingAgeRanges.length) {
        c.age_ranges = Promise.resolve(existingAgeRanges)
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    await manager.save(c)

    return rowErrors
}
