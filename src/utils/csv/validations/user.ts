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
        entity: 'organization',
        attribute: 'name',
        validation: organizationValidations.organization_name.required(),
    },
    user_given_name: {
        entity: 'user',
        attribute: 'given_name',
        validation: userValidations.given_name.required(),
    },
    user_family_name: {
        entity: 'user',
        attribute: 'family_name',
        validation: userValidations.family_name.required(),
    },
    user_shortcode: {
        entity: 'user',
        attribute: 'shortcode',
        validation: sharedValidations.shortcode.allow(null).optional(),
    },
    user_email: {
        entity: 'user',
        attribute: 'email',
        validation: userValidations.email.when('user_phone', {
            is: undefined,
            then: Joi.optional(),
            otherwise: Joi.required(),
        }),
    },
    user_phone: {
        entity: 'user',
        attribute: 'phone',
        validation: userValidations.phone,
    },
    user_date_of_birth: {
        entity: 'user',
        attribute: 'date_of_birth',
        validation: userValidations.date_of_birth.optional(),
    },
    user_gender: {
        entity: 'user',
        attribute: 'gender',
        validation: userValidations.gender.required(),
    },
    organization_role_name: {
        entity: 'user',
        attribute: 'organization_role',
        validation: roleValidations.role_name.required(),
    },
    school_name: {
        entity: 'school',
        attribute: 'name',
        validation: schoolValidations.school_name.allow(null).optional(),
    },
    school_role_name: {
        entity: 'user',
        attribute: 'school_role',
        validation: roleValidations.role_name.allow(null).optional(),
    },
    class_name: {
        entity: 'class',
        attribute: 'name',
        validation: classValidations.class_name.allow(null).optional(),
    },
}
