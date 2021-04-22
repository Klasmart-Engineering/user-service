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
import csvErrorConstants from './errors/csvErrorConstants'

export async function processSchoolFromCSVRow(
    manager: EntityManager,
    row: SchoolRow,
    rowNumber: number,
    fileErrors: CSVError[]
) {
    if (!row.organization_name) {
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

    if (!row.school_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_FIELD,
            rowNumber,
            "school_name",
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                "entity": "school",
                "attribute": "name",
            }
        )
    }

    if (row.school_shortcode?.length > SHORTCODE_DEFAULT_MAXLEN) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "school_shortcode",
            csvErrorConstants.MSG_ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
            {
                "entity": "school",
                "attribute": "shortcode",
                "max": SHORTCODE_DEFAULT_MAXLEN,
            }
        )
    }

    const shortcode = row.school_shortcode
        ? row.school_shortcode.toUpperCase()
        : generateShortCode()

    if (!validateShortCode(shortcode)) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "school_shortcode",
            csvErrorConstants.MSG_ERR_CSV_INVALID_ALPHA_NUM,
            {
                "entity": "school",
                "attribute": "shortcode",
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const organizations = await manager.find(Organization, {
        where: { organization_name: row.organization_name },
    })

    if (!organizations || organizations.length != 1) {
        const organization_count = organizations ? organizations.length : 0
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_FIELD,
            rowNumber,
            "organization_name",
            csvErrorConstants.MSG_ERR_CSV_INVALID_MULTIPLE_EXIST,
            {
                "entity": "organization",
                "name": row.organization_name,
                "count": organization_count,
            }
        )

        return
    }

    const organization = organizations[0]
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
                fileErrors,
                csvErrorConstants.ERR_CSV_INVALID_FIELD,
                rowNumber,
                "school_name",
                csvErrorConstants.MSG_ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD,
                {
                    "entity": "school",
                    "name": row.school_name,
                    "parent_entity": "organization",
                    "parent_name": row.organization_name,
                }
            )

            return
        }
        if (schools.length === 1) {
            school = schools[0]
        }
    }

    school.school_name = row.school_name
    school.shortcode = shortcode
    school.organization = Promise.resolve(organization)
    await manager.save(school)

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
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
            rowNumber,
            "program_name",
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
            {
                "entity": "program",
                "name": row.program_name,
                "parent_entity": "organization",
                "parent_name": row.organization_name,
            }
        )

        return
    }

    for (const p of existingPrograms) {
        if (p.id === programToAdd.id) {
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
                rowNumber,
                "program_name",
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    "entity": "program",
                    "name": row.program_name,
                    "parent_entity": "school",
                    "parent_name": row.school_name,
                }
            )

            return
        }
    }

    existingPrograms.push(programToAdd)

    school.programs = Promise.resolve(existingPrograms)
    await manager.save(school)
}
