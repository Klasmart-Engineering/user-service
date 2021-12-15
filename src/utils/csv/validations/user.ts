import { UserRow } from '../../../types/csv/userRow'
import Joi from 'joi'
import { organizationValidations } from '../../../entities/validations/organization'
import { userValidations } from '../../../entities/validations/user'
import { sharedValidations } from '../../../entities/validations/shared'
import { roleValidations } from '../../../entities/validations/role'
import { schoolValidations } from '../../../entities/validations/school'
import { classValidations } from '../../../entities/validations/class'
import { CsvRowValidationSchema } from './types'
import { UserPermissions } from '../../../permissions/userPermissions'
import { CSVError } from '../../../types/csv/csvError'
import { Organization } from '../../../entities/organization'
import { addCsvError } from '../csvUtils'
import { customErrors } from '../../../types/errors/customError'
import { Role } from '../../../entities/role'
import { School } from '../../../entities/school'
import { Class } from '../../../entities/class'
import { OrganizationMembership } from '../../../entities/organizationMembership'

// CSV rows generally contain a mix of properties from various entities, so we need to define
// custom validation schemas for them, reusing validation rules from the entity
// We also need to associate some meta data with each CSV column in order to produce
// error messages that match the expected format

export const userRowValidation: CsvRowValidationSchema<UserRow> = {
    organization_name: {
        entity: 'Organization',
        attribute: 'Name',
        validation: organizationValidations.organization_name.required(),
    },
    user_given_name: {
        entity: 'User',
        attribute: 'Given Name',
        validation: userValidations.given_name.required(),
    },
    user_family_name: {
        entity: 'User',
        attribute: 'Family Name',
        validation: userValidations.family_name.required(),
    },
    user_shortcode: {
        entity: 'User',
        attribute: 'Short Code',
        validation: sharedValidations.shortcode.allow(null, '').optional(),
    },
    user_email: {
        entity: 'User',
        attribute: 'Email',
        validation: userValidations.email.when('user_phone', {
            is: Joi.exist(),
            then: Joi.optional().allow(null, ''),
            otherwise: Joi.required().messages({
                'any.required': 'email/phone is required',
            }),
        }),
    },
    user_phone: {
        entity: 'User',
        attribute: 'Phone',
        validation: userValidations.phone,
    },
    user_date_of_birth: {
        entity: 'User',
        attribute: 'date of birth',
        validation: userValidations.date_of_birth.optional().allow(null, ''),
    },
    user_gender: {
        entity: 'User',
        attribute: 'Gender',
        validation: userValidations.gender.required(),
    },
    user_alternate_email: {
        entity: 'User',
        attribute: 'Alternate email',
        validation: sharedValidations.email.allow('', null).optional(),
    },
    user_alternate_phone: {
        entity: 'User',
        attribute: 'Alternate phone',
        validation: sharedValidations.phone.allow('', null).optional(),
    },
    organization_role_name: {
        entity: 'Organization',
        attribute: 'Role',
        validation: roleValidations.role_name.required(),
    },
    school_name: {
        entity: 'School',
        attribute: 'Name',
        validation: schoolValidations.school_name.allow(null, '').optional(),
    },
    class_name: {
        entity: 'Class',
        attribute: 'Name',
        validation: classValidations.class_name.allow(null, '').optional(),
    },
}

interface ValidatedCSVEntities {
    orgs: Organization[]
    orgRoles: Role[]
    orgMemberships: OrganizationMembership[]
    schools: School[]
    classes: Class[]
}

export class ValidationStateAndEntities {
    rowErrors: CSVError[]
    validatedEntities: ValidatedCSVEntities

    constructor(
        rowErrors?: CSVError[],
        validatedEntities?: ValidatedCSVEntities
    ) {
        if (rowErrors) {
            this.rowErrors = rowErrors
        } else {
            this.rowErrors = []
        }

        if (validatedEntities) {
            this.validatedEntities = validatedEntities
        } else {
            this.validatedEntities = {
                orgs: [],
                orgRoles: [],
                orgMemberships: [],
                schools: [],
                classes: [],
            }
        }
    }
}

// For each unique org name, check if client user is member + check if org name exists
export async function validateOrgsInCSV(
    userRows: UserRow[],
    userPermissions: UserPermissions,
    validationStateAndEntities: ValidationStateAndEntities
): Promise<ValidationStateAndEntities> {
    const uniqueOrgNamesInCSV = Array.from(
        new Set(userRows.map((row) => row.organization_name))
    )
    const validOrgs: Organization[] = []

    // Get all unique orgs named in the CSV
    if (uniqueOrgNamesInCSV) {
        const validOrgsInCSV = await Organization.createQueryBuilder(
            'Organization'
        )
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .where('OrganizationMembership.user_id = :user_id', {
                user_id: userPermissions.getUserId(),
            })
            .andWhere('Organization.organization_name IN (:...orgNames)', {
                orgNames: uniqueOrgNamesInCSV,
            })
            .getMany()
        validOrgs.push(...validOrgsInCSV)
    }

    // Compare this list of unique orgs from the DB to what's provided in the CSV to detect invalid orgs
    const validOrgNames = validOrgs.map((_) => _.organization_name!)
    const invalidOrgNames = uniqueOrgNamesInCSV.filter(
        (name) => !validOrgNames.includes(name)
    )

    // Record row errors and add to validation state object
    let rowNumber = 1
    for (const row of userRows) {
        if (invalidOrgNames.includes(row.organization_name)) {
            addCsvError(
                validationStateAndEntities.rowErrors,
                customErrors.nonexistent_entity.code,
                rowNumber,
                'organization_name',
                customErrors.nonexistent_entity.message,
                {
                    entity: 'Organization',
                    attribute: 'Name',
                    entityName: row.organization_name,
                }
            )
        }
        rowNumber += 1
    }

    // Add validated unique orgs to validation state object
    validationStateAndEntities.validatedEntities.orgs.push(...validOrgs)

    return validationStateAndEntities
}

// export async function validateOrgUploadPermsForCSV(
//     userRows: UserRow[],
//     userPermissions: UserPermissions,
//     rowErrors: CSVError[]
// ): Promise<CSVError[]> {
//     let rowNumber = 1
//     const orgNamesInCSV = userRows.map((row) => row.organization_name)
//     const uniqueOrgNames = new Set(orgNamesInCSV)
//     const invalidOrgNames: string[] = []

//     for (const orgName of uniqueOrgNames) {
//     }

//     try {
//         await userPermissions.rejectIfNotAllowed(
//             { organization_ids: [org.organization_id] },
//             PermissionName.upload_users_40880
//         )
//     } catch (e) {
//         addCsvError(
//             rowErrors,
//             customErrors.unauthorized_org_upload.code,
//             rowNumber,
//             'organization_name',
//             customErrors.unauthorized_org_upload.message,
//             {
//                 entity: 'user',
//                 organizationName: row.organization_name,
//             }
//         )
//     }
// }
