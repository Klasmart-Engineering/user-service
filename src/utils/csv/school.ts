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

export async function processSchoolFromCSVRow(
    manager: EntityManager,
    row: SchoolRow,
    rowNumber: number
) {
    if (!row.organization_name) {
        throw new Error(
            `Row: ${rowNumber}. Mandatory Organization name is empty`
        )
    }

    if (!row.school_name) {
        throw new Error(`Row: ${rowNumber}. Mandatory School name is empty`)
    }

    if (row.school_shortcode.length > SHORTCODE_DEFAULT_MAXLEN) {
        throw new Error(
            `Row: ${rowNumber}. School shortcode '${row.school_shortcode}' is ${row.school_shortcode.length} characters long, it must be no more than ${SHORTCODE_DEFAULT_MAXLEN} characters`
        )
    }

    const shortcode = row.school_shortcode
        ? row.school_shortcode.toUpperCase()
        : generateShortCode()

    if (!validateShortCode(shortcode)) {
        throw new Error(
            `Row: ${rowNumber}. School shortcode '${shortcode}' fails validation, must be only uppercase letters (A-Z) and numbers no spaces or symbols`
        )
    }

    const organizations = await manager.find(Organization, {
        where: { organization_name: row.organization_name },
    })

    if (!organizations || organizations.length != 1) {
        const organization_count = organizations ? organizations.length : 0
        throw new Error(
            `Row: ${rowNumber}. Organizations name '${row.organization_name}' matches ${organization_count} Organizations, it should match one Organization`
        )
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
            throw new Error(
                `Row: ${rowNumber}. School name '${row.school_name}' already exists more than once in '${row.organization_name}'`
            )
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
    let programToAdd
    if (row.program_name) {
        // does the program belong to organisation or a system program
        programToAdd = await manager.findOne(Program, {
            where: [
                { name: row.program_name, organization: organization },
                { name: row.program_name, organization: null, system: true },
            ],
        })
        if (!programToAdd) {
            throw `Program '${row.program_name}' at row ${rowNumber} not associated for Organisation ${row.organization_name}`
        }
        for (const p of existingPrograms) {
            if (p.id === programToAdd.id) {
                throw `Program '${row.program_name}' at row ${rowNumber} is already related to '${row.school_name}'`
            }
        }
        existingPrograms.push(programToAdd)
    } else {
        // get program with none specified
        programToAdd = await manager.findOne(Program, {
            where: { name: 'None Specified' },
        })
        if (programToAdd) {
            existingPrograms.push(programToAdd)
        }
    }

    school.programs = Promise.resolve(existingPrograms)
    await manager.save(school)
}
