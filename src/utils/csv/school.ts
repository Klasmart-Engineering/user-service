import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Program } from '../../entities/program'
import { School } from '../../entities/school'
import { SchoolRow } from '../../types/csv/schoolRow'
import {
    generateShortCode,
    SHORTCODE_DEFAULT_MAXLEN,
    validateShortCode,
} from '../shortcode'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import validationConstants from '../../entities/validations/constants'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { UserPermissions } from '../../permissions/userPermissions'

export const processSchoolFromCSVRow: CreateEntityRowCallback<SchoolRow> = async (
    manager: EntityManager,
    row: SchoolRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    if (!row.organization_name) {
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

    if (!row.school_name) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'school_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'school',
                attribute: 'name',
            }
        )
    }

    if (row.school_name?.length > validationConstants.SCHOOL_NAME_MAX_LENGTH) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_LENGTH,
            rowNumber,
            'school_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_LENGTH,
            {
                entity: 'school',
                attribute: 'name',
                max: validationConstants.SCHOOL_NAME_MAX_LENGTH,
            }
        )
    }

    if (row.school_shortcode?.length > SHORTCODE_DEFAULT_MAXLEN) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
            rowNumber,
            'school_shortcode',
            csvErrorConstants.MSG_ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
            {
                entity: 'school',
                attribute: 'shortcode',
                max: SHORTCODE_DEFAULT_MAXLEN,
            }
        )
    }

    const shortcode = row.school_shortcode
        ? row.school_shortcode.toUpperCase()
        : generateShortCode()

    if (!validateShortCode(shortcode)) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_ALPHA_NUM,
            rowNumber,
            'school_shortcode',
            csvErrorConstants.MSG_ERR_CSV_INVALID_ALPHA_NUM,
            {
                entity: 'school',
                attribute: 'shortcode',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organizations = await manager.find(Organization, {
        where: { organization_name: row.organization_name },
    })

    if (!organizations || organizations.length != 1) {
        const organization_count = organizations ? organizations.length : 0
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_MULTIPLE_EXIST,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_MULTIPLE_EXIST,
            {
                entity: 'organization',
                name: row.organization_name,
                count: organization_count,
            }
        )

        return rowErrors
    }

    const organization = organizations[0]

    const schoolShortcode = await manager.findOne(School, {
        where: {
            shortcode: row.school_shortcode,
            organization: { organization_id: organization.organization_id },
        },
    })

    if (schoolShortcode && row.school_name !== schoolShortcode.school_name) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
            rowNumber,
            'school_shortcode',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                entity: 'shortcode',
                name: row.school_shortcode,
                parent_entity: 'school',
                parent_name: schoolShortcode.school_name,
            }
        )
    }

    const schools = await manager.find(School, {
        where: {
            school_name: row.school_name,
            organization: organization,
        },
    })

    let school = new School()

    if (schools) {
        if (schools.length > 1) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD,
                rowNumber,
                'school_name',
                csvErrorConstants.MSG_ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD,
                {
                    entity: 'school',
                    name: row.school_name,
                    parent_entity: 'organization',
                    parent_name: row.organization_name,
                }
            )

            return rowErrors
        }
        if (schools.length === 1) {
            school = schools[0]
        }
    }

    school.school_name = row.school_name
    school.shortcode = shortcode
    school.organization = Promise.resolve(organization)

    const existingPrograms = (await school.programs) || []

    if (!row.program_name) {
        row.program_name = 'None Specified'
    }
    // does the program belong to organisation or a system program
    const programToAdd = await manager.findOne(Program, {
        where: [
            { name: row.program_name, organization: organization },
            {
                name: row.program_name,
                organization: null,
                system: true,
            },
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
                entity: 'program',
                name: row.program_name,
                parent_entity: 'organization',
                parent_name: row.organization_name,
            }
        )

        return rowErrors
    }

    for (const p of existingPrograms) {
        if (p.id === programToAdd.id) {
            addCsvError(
                rowErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'program_name',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'program',
                    name: row.program_name,
                    parent_entity: 'school',
                    parent_name: row.school_name,
                }
            )

            return rowErrors
        }
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    existingPrograms.push(programToAdd)

    school.programs = Promise.resolve(existingPrograms)
    await manager.save(school)

    return rowErrors
}
