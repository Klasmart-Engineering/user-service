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

// For each unique org name, check if client user is member + check if org name exists
export async function validateOrgsInCSV(
    userRows: UserRow[],
    userPermissions: UserPermissions,
    rowErrors: CSVError[]
): Promise<CSVError[]> {
    let rowNumber = 1
    const orgNamesInCSV = userRows.map((row) => row.organization_name)
    const uniqueOrgNames = new Set(orgNamesInCSV)
    const invalidOrgNames: string[] = []
    for (const orgName of uniqueOrgNames) {
        const org = await Organization.createQueryBuilder('Organization')
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .where('OrganizationMembership.user_id = :user_id', {
                user_id: userPermissions.getUserId(),
            })
            .andWhere('Organization.organization_name = :organization_name', {
                organization_name: orgName,
            })
            .getOne()

        if (!org) {
            invalidOrgNames.push(orgName)
        }
    }
    for (const row of userRows) {
        if (row.organization_name in invalidOrgNames) {
            addCsvError(
                rowErrors,
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
    return rowErrors
}
