import { EntityManager, Not } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Class } from '../../entities/class'
import { School } from '../../entities/school'
import { Program } from '../../entities/program'
import { generateShortCode } from '../shortcode'
import { ClassRow } from '../../types/csv/classRow'
import { CSVError } from '../../types/csv/csvError'
import { addCsvError } from '../csv/csvUtils'
import csvErrorConstants from './errors/csvErrorConstants'

export const processClassFromCSVRow = async (
    manager: EntityManager,
    {
        organization_name,
        class_name,
        class_shortcode,
        school_name,
        program_name,
    }: ClassRow,
    rowNumber: number,
    fileErrors: CSVError[]
) => {
    if (!organization_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_FIELD,
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
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_FIELD,
            rowNumber,
            'class_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'class',
                attribute: 'name',
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const org = await Organization.findOne({ organization_name })

    if (!org) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )

        return
    }

    const classInDatabase = await Class.findOne({
        where: { organization: org, class_name },
    })

    if (classInDatabase) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
            rowNumber,
            'class_name',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_ENTITY,
            {
                name: class_name,
                entity: 'class',
            }
        )

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
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
            rowNumber,
            'class_shortcode',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                name: class_name,
                entity: 'class',
                parent_name: organization_name,
                parent_entity: 'organization',
            }
        )

        return
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
                fileErrors,
                csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
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

            return
        }

        const existingSchoolNames = existingSchools.map(
            (school) => school.school_name
        )

        if (existingSchoolNames.includes(school_name)) {
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
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
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_NONE_EXISTING_ENTITY,
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

            return
        }

        const existingProgramNames = existingPrograms.map(
            (program) => program.name
        )

        if (existingProgramNames.includes(program_name)) {
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
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
