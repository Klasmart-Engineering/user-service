import { UserRow } from '../../../types/csv/userRow'
import Joi from 'joi'
import { organizationValidations } from '../../../entities/validations/organization'
import { userValidations } from '../../../entities/validations/user'
import { sharedValidations } from '../../../entities/validations/shared'
import { roleValidations } from '../../../entities/validations/role'
import { schoolValidations } from '../../../entities/validations/school'
import { classValidations } from '../../../entities/validations/class'
import { CsvRowValidationSchema } from './types'

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
        validation: sharedValidations.email
            .optional()
            .allow(null, '')
            .empty(''),
    },
    user_phone: {
        entity: 'User',
        attribute: 'Phone',
        validation: userValidations.phone.optional().allow(null, '').empty(''),
    },

    user_username: {
        entity: 'User',
        attribute: 'Username',
        validation: userValidations.username.empty(null).when('user_phone', {
            is: Joi.string(),
            then: Joi.optional().allow(null, ''),
            otherwise: Joi.when('user_email', {
                is: Joi.string(),
                then: Joi.optional().allow(null, ''),
                otherwise: Joi.required().messages({
                    'any.required': 'username/phone/email is required',
                }),
            }),
        }),
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
