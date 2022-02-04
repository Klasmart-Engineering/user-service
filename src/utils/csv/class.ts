import { EntityManager, Not } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Class } from '../../entities/class'
import { School } from '../../entities/school'
import { Program } from '../../entities/program'
import {
    generateShortCode,
    SHORTCODE_DEFAULT_MAXLEN,
    validateShortCode,
} from '../shortcode'
import { ClassRow } from '../../types/csv/classRow'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { UserPermissions } from '../../permissions/userPermissions'
import { config } from '../../config/config'
import { REGEX } from '../../entities/validations/regex'
import { customErrors } from '../../types/errors/customError'

export const processClassFromCSVRow: CreateEntityRowCallback<ClassRow> = async (
    manager: EntityManager,
    {
        organization_name,
        class_name,
        class_shortcode,
        school_name,
        program_name,
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

    if (!class_name.match(REGEX.alphanum_with_special_characters)) {
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

        const existingSchoolNames = existingSchools.map(
            (school) => school.school_name
        )

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

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    c.programs = Promise.resolve(existingPrograms)
    await manager.save(c)

    return rowErrors
}
