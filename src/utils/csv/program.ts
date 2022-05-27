import { Brackets, EntityManager, IsNull } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { Grade } from '../../entities/grade'
import { Organization } from '../../entities/organization'
import { Program } from '../../entities/program'
import { Subject } from '../../entities/subject'
import { ProgramRow } from '../../types/csv/programRow'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import { UserPermissions } from '../../permissions/userPermissions'
import { validateAgeRanges } from './validations/ageRange'
import { Status } from '../../entities/status'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processProgramFromCSVRow = async (
    manager: EntityManager,
    row: ProgramRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    let ageRange: AgeRange | null
    let grade: Grade | null
    let subject: Subject | null
    let program: Program | null
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

    if (!program_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'program_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'program',
                attribute: 'name',
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

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
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

    // Is the user authorized to upload programs to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
            PermissionName.create_program_20221
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'program',
                organizationName: organization.organization_name,
            }
        )
        return rowErrors
    }

    const ageRangeName = `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`
    if (!age_range_low_value && !age_range_high_value && !age_range_unit) {
        ageRange = await manager.findOneOrFail(AgeRange, {
            where: {
                name: 'None Specified',
                system: true,
                status: Status.ACTIVE,
                organization: IsNull(),
            },
        })
    } else {
        ageRange = await AgeRange.createQueryBuilder('AgeRange')
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
                                    organizationId:
                                        organization.organization_id,
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
    }

    if (!ageRange) {
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
    }

    if (!grade_name) {
        grade = await manager.findOneOrFail(Grade, {
            where: {
                name: 'None Specified',
                system: true,
                status: Status.ACTIVE,
                organization: IsNull(),
            },
        })
    } else {
        grade = await manager.findOne(Grade, {
            where: {
                name: grade_name,
                system: false,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            },
        })
    }

    if (!grade) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_child.code,
            rowNumber,
            'grade_name',
            customErrors.nonexistent_child.message,
            {
                entity: 'grade',
                entityName: grade_name,
                parentEntity: 'organization',
                parentName: organization_name,
            }
        )
    }

    if (!subject_name) {
        subject = await manager.findOneOrFail(Subject, {
            where: {
                name: 'None Specified',
                system: true,
                status: Status.ACTIVE,
                organization: IsNull(),
            },
        })
    } else {
        subject = await manager.findOne(Subject, {
            where: {
                name: subject_name,
                system: false,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            },
        })
    }

    if (!subject) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_child.code,
            rowNumber,
            'subject_name',
            customErrors.nonexistent_child.message,
            {
                entity: 'subject',
                entityName: subject_name,
                parentEntity: 'organization',
                parentName: organization_name,
            }
        )
    }

    if (fileErrors.length > 0 || !ageRange || !grade || !subject) {
        return rowErrors
    }

    program = await manager.findOne(Program, {
        where: {
            name: program_name,
            system: false,
            status: Status.ACTIVE,
            organization: { organization_id: organization.organization_id },
        },
    })

    if (program) {
        programAgeRanges = (await program.age_ranges) || []
        const ageRangeNames = programAgeRanges.map(({ name }) => name)

        if (ageRangeNames.includes(ageRangeName)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'age_range_low_value, age_range_high_value, age_range_unit',
                customErrors.existent_child_entity.message,
                {
                    entity: 'ageRange',
                    entityName: ageRangeName,
                    parentEntity: 'program',
                    parentName: program.name,
                }
            )

            return rowErrors
        }

        programGrades = (await program.grades) || []
        const gradeNames = programGrades.map(({ name }) => name)

        if (gradeNames.includes(grade_name)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'grade_name',
                customErrors.existent_child_entity.message,
                {
                    entity: 'grade',
                    entityName: grade_name,
                    parentEntity: 'program',
                    parentName: program.name,
                }
            )

            return rowErrors
        }

        programSubjects = (await program.subjects) || []
        const subjectNames = programSubjects.map(({ name }) => name)

        if (subjectNames.includes(subject_name)) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'subject_name',
                customErrors.existent_child_entity.message,
                {
                    entity: 'subject',
                    entityName: subject_name,
                    parentEntity: 'program',
                    parentName: program.name,
                }
            )

            return rowErrors
        }
    } else {
        program = new Program()
        program.name = program_name
        program.organization = Promise.resolve(organization)
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    programAgeRanges.push(ageRange)
    programGrades.push(grade)
    programSubjects.push(subject)

    program.age_ranges = Promise.resolve(programAgeRanges)
    program.grades = Promise.resolve(programGrades)
    program.subjects = Promise.resolve(programSubjects)

    await manager.save(program)

    return rowErrors
}
