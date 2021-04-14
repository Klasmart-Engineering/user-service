import { EntityManager } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { Program } from '../../entities/program'
import { Subject } from '../../entities/subject'
import { ProgramRow } from '../../types/csv/programRow'

export async function processProgramFromCSVRow(
    manager: EntityManager,
    row: ProgramRow,
    rowNumber: number
) {
    let highValueNumber: number
    let lowValueNumber: number
    let organization: Organization | undefined
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

    try {
        if (!organization_name) {
            throw new Error('Organization name is not provided')
        }

        if (!program_name) {
            throw new Error('Program name is not provided')
        }

        if (!allAgeRangeFieldsExists && !noneOfAgeRangeFieldsExists) {
            throw new Error(
                'In the same row should exists age_range_high_value, age_range_low_value and age_range_unit or none of them'
            )
        }

        highValueNumber = Number(age_range_high_value)
        lowValueNumber = Number(age_range_low_value)

        if (
            age_range_high_value &&
            (Number.isNaN(highValueNumber) ||
                !Number.isInteger(highValueNumber) ||
                highValueNumber < 1 ||
                highValueNumber > 99)
        ) {
            throw new Error(
                'age_range_high_value should be an integer number greather than 0 and lower than 100'
            )
        }

        if (
            age_range_low_value &&
            (Number.isNaN(lowValueNumber) ||
                !Number.isInteger(lowValueNumber) ||
                lowValueNumber < 0 ||
                lowValueNumber > 99)
        ) {
            throw new Error(
                'age_range_low_value should be an integer number greather or equal to 0 and lower than 100'
            )
        }

        if (
            age_range_low_value &&
            age_range_high_value &&
            lowValueNumber >= highValueNumber
        ) {
            throw new Error(
                'age_range_high_value should be greather than age_range_low_value'
            )
        }

        if (
            age_range_unit &&
            age_range_unit !== AgeRangeUnit.MONTH &&
            age_range_unit !== AgeRangeUnit.YEAR
        ) {
            throw new Error("age_range_unit should be 'month' or 'year'")
        }

        organization = await manager.findOne(Organization, {
            where: { organization_name },
        })

        if (!organization) {
            throw new Error(
                `Provided organization with name '${organization_name}' doesn't exists`
            )
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
            throw new Error(
                "Provided age range doesn't exists in the provided organization"
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
            throw new Error(
                "Provided grade doesn't exists in the provided organization"
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
            throw new Error(
                "Provided subject doesn't exists in the provided organization"
            )
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
                throw new Error(
                    'Provided age range already exists in the provided program'
                )
            }

            programGrades = (await program.grades) || []
            const gradeNames = programGrades.map(({ name }) => name)

            if (gradeNames.includes(grade_name)) {
                throw new Error(
                    'Provided grade already exists in the provided program'
                )
            }

            programSubjects = (await program.subjects) || []
            const subjectNames = programSubjects.map(({ name }) => name)

            if (subjectNames.includes(subject_name)) {
                throw new Error(
                    'Provided subject already exists in the provided program'
                )
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
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}
