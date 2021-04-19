import { EntityManager, Not } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Class } from '../../entities/class'
import { School } from '../../entities/school'
import { Program } from '../../entities/program'
import { generateShortCode } from '../shortcode'
import { ClassRow } from '../../types/csv/classRow'
import { saveError } from './readFile'

export const processClassFromCSVRow = async (
    manager: EntityManager,
    {
        organization_name,
        class_name,
        class_shortcode,
        school_name,
        program_name,
    }: ClassRow,
    rowCount: number,
    fileErrors: string[]
) => {
    const requiredFieldsAreProvided = organization_name && class_name

    if (!organization_name) {
        saveError(fileErrors, rowCount, 'missing organization_name')
    }

    if (!class_name) {
        saveError(fileErrors, rowCount, 'missing class_name')
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const org = await Organization.findOne({ organization_name })

    if (!org) {
        saveError(fileErrors, rowCount, "Organisation doesn't exist")
        return
    }

    if (
        class_shortcode &&
        (await Class.findOne({
            where: {
                shortcode: class_shortcode,
                organization: org,
                class_name: Not(class_name),
            },
        }))
    ) {
        saveError(
            fileErrors,
            rowCount,
            `Duplicate class classShortCode '${class_name}'`
        )
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
            saveError(
                fileErrors,
                rowCount,
                `School doesn't exist for Organisation '${organization_name}'`
            )

            return
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
            saveError(
                fileErrors,
                rowCount,
                `Program is not associated for Organisation '${organization_name}'`
            )
            return
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
    await manager.save(c)
}
