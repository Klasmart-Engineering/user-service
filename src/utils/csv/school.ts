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
import { saveError } from './readFile'

export async function processSchoolFromCSVRow(
    manager: EntityManager,
    row: SchoolRow,
    rowNumber: number,
    fileErrors: string[]
) {
    const requiredFieldsAreProvided = row.organization_name && row.school_name

    if (!row.organization_name) {
        saveError(fileErrors, rowNumber, 'Mandatory Organization name is empty')
    }

    if (!row.school_name) {
        saveError(fileErrors, rowNumber, 'Mandatory School name is empty')
    }

    if (row.school_shortcode?.length > SHORTCODE_DEFAULT_MAXLEN) {
        saveError(
            fileErrors,
            rowNumber,
            `School shortcode '${row.school_shortcode}' is ${row.school_shortcode.length} characters long, it must be no more than ${SHORTCODE_DEFAULT_MAXLEN} characters`
        )

        return
    }

    const shortcode = row.school_shortcode
        ? row.school_shortcode.toUpperCase()
        : generateShortCode()

    if (!validateShortCode(shortcode)) {
        saveError(
            fileErrors,
            rowNumber,
            `School shortcode '${shortcode}' fails validation, must be only uppercase letters (A-Z) and numbers no spaces or symbols`
        )
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const organizations = await manager.find(Organization, {
        where: { organization_name: row.organization_name },
    })

    if (!organizations || organizations.length != 1) {
        const organization_count = organizations ? organizations.length : 0
        saveError(
            fileErrors,
            rowNumber,
            `Organizations name '${row.organization_name}' matches ${organization_count} Organizations, it should match one Organization`
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
            saveError(
                fileErrors,
                rowNumber,
                `School name '${row.school_name}' already exists more than once in '${row.organization_name}'`
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
        saveError(
            fileErrors,
            rowNumber,
            `Program '${row.program_name}' not associated for Organisation ${row.organization_name}`
        )

        return
    }

    for (const p of existingPrograms) {
        if (p.id === programToAdd.id) {
            saveError(
                fileErrors,
                rowNumber,
                `Program '${row.program_name}' is already related to '${row.school_name}'`
            )

            return
        }
    }

    existingPrograms.push(programToAdd)

    school.programs = Promise.resolve(existingPrograms)
    await manager.save(school)
}
