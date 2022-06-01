import { Brackets, EntityManager, Not } from 'typeorm'
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
import { Status } from '../../entities/status'
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
        academic_period,
    }: ClassRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
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

    if (!class_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'class_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'class',
                attribute: 'name',
            }
        )
    }

    if (class_name?.length > config.limits.CLASS_NAME_MAX_LENGTH) {
        addCsvError(
            rowErrors,
            customErrors.invalid_max_length.code,
            rowNumber,
            'class_name',
            customErrors.invalid_max_length.message,
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

    const org = await Organization.findOneBy({ organization_name })

    if (!org) {
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

    const classInDatabase = await Class.findBy({
        organization: { organization_id: org.organization_id },
        class_name,
    })

    if (classInDatabase.length) {
        addCsvError(
            rowErrors,
            customErrors.existent_entity.code,
            rowNumber,
            'class_name',
            customErrors.existent_entity.message,
            {
                entityName: class_name,
                entity: 'class',
            }
        )

        return rowErrors
    }

    const classExist = await manager.findOne(Class, {
        where: {
            shortcode: class_shortcode,
            organization: { organization_id: org.organization_id },
            class_name: Not(class_name),
        },
    })

    if (class_shortcode && classExist) {
        addCsvError(
            rowErrors,
            customErrors.existent_child_entity.code,
            rowNumber,
            'class_shortcode',
            customErrors.existent_child_entity.message,
            {
                entityName: class_shortcode,
                entity: 'shortcode',
                parentName: classExist.class_name,
                parentEntity: 'class',
            }
        )

        return rowErrors
    }

    // check if class exists in manager
    const classInManager = await manager.findOne(Class, {
        where: {
            class_name,
            organization: { organization_id: org.organization_id },
        },
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
            where: {
                school_name,
                organization: { organization_id: org.organization_id },
            },
        })

        if (!school) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'school_name',
                customErrors.nonexistent_child.message,
                {
                    entityName: school_name,
                    entity: 'school',
                    parentName: organization_name,
                    parentEntity: 'organization',
                }
            )

            return rowErrors
        }

        const existingSchoolNames = existingSchools.map((s) => s.school_name)

        if (existingSchoolNames.includes(school_name)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'school_name',
                customErrors.existent_child_entity.message,
                {
                    entityName: school_name,
                    entity: 'school',
                    parentName: class_name,
                    parentEntity: 'class',
                }
            )

            return rowErrors
        }

        existingSchools.push(school)
    }

    /**
     * NOTE: "academic term" and "academic period" are equivalent: https://calmisland.atlassian.net/browse/UD-2551
     * Internal schema naming keeps "AcademicTerm" for convenience
     */
    if (academic_period) {
        const academicTerm = await AcademicTerm.findOneBy({
            name: academic_period,
        })
        if (!academicTerm) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_entity.code,
                rowNumber,
                'academic_period',
                customErrors.nonexistent_entity.message,
                {
                    entityName: academic_period,
                    entity: 'AcademicPeriod',
                }
            )
        }
        if (existingSchools.length !== 1) {
            addCsvError(
                rowErrors,
                customErrors.must_have_exactly_n.code,
                rowNumber,
                'school_name',
                customErrors.must_have_exactly_n.message,
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
                    customErrors.nonexistent_child.code,
                    rowNumber,
                    'academic_period',
                    customErrors.nonexistent_child.message,
                    {
                        entityName: academic_period,
                        entity: 'AcademicPeriod',
                        parentName: school_name,
                        parentEntity: 'School',
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
        programToAdd = await Program.createQueryBuilder('Program')
            .leftJoin('Program.organization', 'Organization')
            .where('name = :programName', { programName: program_name })
            .andWhere(
                new Brackets((qb) => {
                    qb.where('Organization.organization_id = :organizationId', {
                        organizationId: org.organization_id,
                    }).orWhere(
                        new Brackets((qb) => {
                            qb.where('system = true').andWhere(
                                'Organization.organization_id IS NULL'
                            )
                        })
                    )
                })
            )
            .getOne()

        if (!programToAdd) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'program_name',
                customErrors.nonexistent_child.message,
                {
                    entityName: program_name,
                    entity: 'program',
                    parentName: organization_name,
                    parentEntity: 'organization',
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
                customErrors.existent_child_entity.code,
                rowNumber,
                'program_name',
                customErrors.existent_child_entity.message,
                {
                    entityName: program_name,
                    entity: 'program',
                    parentName: class_name,
                    parentEntity: 'class',
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
        const gradeToAdd = await Grade.createQueryBuilder('Grade')
            .leftJoin('Grade.organization', 'Organization')
            .where('name = :gradeName', { gradeName: grade_name })
            .andWhere(
                new Brackets((qb) => {
                    qb.where('Organization.organization_id = :organizationId', {
                        organizationId: org.organization_id,
                    }).orWhere(
                        new Brackets((qb) => {
                            qb.where('system = true').andWhere(
                                'Organization.organization_id IS NULL'
                            )
                        })
                    )
                })
            )
            .getOne()

        if (!gradeToAdd) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'grade_name',
                customErrors.nonexistent_child.message,
                {
                    entityName: grade_name,
                    entity: 'grade',
                    parentName: organization_name,
                    parentEntity: 'organization',
                }
            )

            return rowErrors
        }

        const existingGradeNames = existingGrades.map((grade) => grade.name)

        if (existingGradeNames.includes(grade_name)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'grade_name',
                customErrors.existent_child_entity.message,
                {
                    entityName: grade_name,
                    entity: 'grade',
                    parentName: class_name,
                    parentEntity: 'class',
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
        const subjectToAdd = await Subject.createQueryBuilder('Subject')
            .leftJoin('Subject.organization', 'Organization')
            .where('name = :subjectName', { subjectName: subject_name })
            .andWhere(
                new Brackets((qb) => {
                    qb.where('Organization.organization_id = :organizationId', {
                        organizationId: org.organization_id,
                    }).orWhere(
                        new Brackets((qb) => {
                            qb.where('system = true').andWhere(
                                'Organization.organization_id IS NULL'
                            )
                        })
                    )
                })
            )
            .getOne()

        if (!subjectToAdd) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'subject_name',
                customErrors.nonexistent_child.message,
                {
                    entityName: subject_name,
                    entity: 'subject',
                    parentName: organization_name,
                    parentEntity: 'organization',
                }
            )

            return rowErrors
        }

        const existingSubjectNames = existingSubjects.map((s) => s.name)

        if (existingSubjectNames.includes(subject_name)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'subject_name',
                customErrors.existent_child_entity.message,
                {
                    entityName: subject_name,
                    entity: 'subject',
                    parentName: class_name,
                    parentEntity: 'class',
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
        const ageRangeToAdd = await AgeRange.createQueryBuilder('AgeRange')
            .leftJoin('AgeRange.organization', 'Organization')
            .where('name = :ageRangeName', { ageRangeName })
            .andWhere('low_value = :lowValue', {
                lowValue: Number(age_range_low_value),
            })
            .andWhere('high_value = :highValue', {
                highValue: Number(age_range_high_value),
            })
            .andWhere('low_value_unit = :lowValueUnit', {
                lowValueUnit: age_range_unit,
            })
            .andWhere('AgeRange.status = :active', {
                active: Status.ACTIVE,
            })
            .andWhere(
                new Brackets((qb) => {
                    qb.where(
                        new Brackets((qb2) => {
                            qb2.where(
                                'Organization.organization_id = :organizationId',
                                {
                                    organizationId: org.organization_id,
                                }
                            ).andWhere('system = false')
                        })
                    ).orWhere(
                        new Brackets((qb2) => {
                            qb2.where(
                                'Organization.organization_id IS NULL'
                            ).andWhere('system = true')
                        })
                    )
                })
            )
            .getOne()

        if (!ageRangeToAdd) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'age_range_low_value, age_range_high_value, age_range_unit',
                customErrors.nonexistent_child.message,
                {
                    entity: 'ageRange',
                    entityName: ageRangeName,
                    parentEntity: 'organization',
                    parentName: organization_name,
                }
            )
            return rowErrors
        }

        const existingAgeRangeNames = existingAgeRanges.map((ar) => ar.name)

        if (existingAgeRangeNames.includes(ageRangeName)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'age_range_low_value, age_range_high_value, age_range_unit',
                customErrors.existent_child_entity.message,
                {
                    entity: 'ageRange',
                    entityName: ageRangeName,
                    parentEntity: 'class',
                    parentName: class_name,
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
