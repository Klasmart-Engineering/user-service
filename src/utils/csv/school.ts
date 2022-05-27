import { Brackets, EntityManager } from 'typeorm'
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
import { UserPermissions } from '../../permissions/userPermissions'
import { config } from '../../config/config'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processSchoolFromCSVRow = async (
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

    if (!row.school_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'school_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'school',
                attribute: 'name',
            }
        )
    }

    if (row.school_name?.length > config.limits.SCHOOL_NAME_MAX_LENGTH) {
        addCsvError(
            rowErrors,
            customErrors.invalid_max_length.code,
            rowNumber,
            'school_name',
            customErrors.invalid_max_length.message,
            {
                entity: 'school',
                attribute: 'name',
                max: config.limits.SCHOOL_NAME_MAX_LENGTH,
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
            customErrors.invalid_alphanumeric.code,
            rowNumber,
            'school_shortcode',
            customErrors.invalid_alphanumeric.message,
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

    // Is the user authorized to upload schools to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
            PermissionName.create_school_20220
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'school',
                organizationName: organization.organization_name,
            }
        )
        return rowErrors
    }

    const schoolShortcode = await manager.findOne(School, {
        where: {
            shortcode: row.school_shortcode,
            organization: { organization_id: organization.organization_id },
        },
    })

    if (schoolShortcode && row.school_name !== schoolShortcode.school_name) {
        addCsvError(
            rowErrors,
            customErrors.existent_child_entity.code,
            rowNumber,
            'school_shortcode',
            customErrors.existent_child_entity.message,
            {
                entity: 'shortcode',
                entityName: row.school_shortcode,
                parentEntity: 'school',
                parentName: schoolShortcode.school_name,
            }
        )
    }

    const schools = await manager.find(School, {
        where: {
            school_name: row.school_name,
            organization: { organization_id: organization.organization_id },
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
    const programToAdd = await Program.createQueryBuilder('Program')
        .leftJoin('Program.organization', 'Organization')
        .where('name = :programName', { programName: row.program_name })
        .andWhere(
            new Brackets((qb) => {
                qb.where('Organization.organization_id = :organizationId', {
                    organizationId: organization.organization_id,
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
                entity: 'program',
                entityName: row.program_name,
                parentEntity: 'organization',
                parentName: row.organization_name,
            }
        )

        return rowErrors
    }

    for (const p of existingPrograms) {
        if (p.id === programToAdd.id) {
            addCsvError(
                rowErrors,
                customErrors.existent_child_entity.code,
                rowNumber,
                'program_name',
                customErrors.existent_child_entity.message,
                {
                    entity: 'program',
                    entityName: row.program_name,
                    parentEntity: 'school',
                    parentName: row.school_name,
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
