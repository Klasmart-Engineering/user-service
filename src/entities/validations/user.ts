import Joi from 'joi'
import validationConstants from './constants'
import { sharedValidations } from './shared'
import { REGEX } from './regex'

export const userValidations = {
    user_id: Joi.string().uuid(),

    given_name: sharedValidations.alphanum_with_special_characters
        .required()
        .max(validationConstants.USER_GIVEN_NAME_MAX_LENGTH),

    family_name: sharedValidations.alphanum_with_special_characters
        .required()
        .max(validationConstants.USER_FAMILY_NAME_MAX_LENGTH),

    email: sharedValidations.email.empty(null).when('phone', {
        is: Joi.string().exist(),
        then: Joi.optional().allow('', null),
        otherwise: Joi.required().messages({
            'string.base': 'email/phone is required',
            'any.required': 'email/phone is required',
            'string.empty': 'email/phone is required',
        }),
    }),

    phone: sharedValidations.phone.allow(null, '').empty(null),

    date_of_birth: Joi.string().allow(null, '').regex(REGEX.dob, {
        name: 'date_mm_yyy',
    }),

    username: sharedValidations.alphanum_with_special_characters
        .allow('', null)
        .optional()
        .max(validationConstants.USERNAME_MAX_LEN),

    gender: sharedValidations.alphanum_with_special_characters
        .required()
        .min(validationConstants.GENDER_MIN_LENGTH)
        .max(validationConstants.GENDER_MAX_LENGTH),

    alternate_email: sharedValidations.email.allow('', null).optional(),

    alternate_phone: sharedValidations.phone.allow('', null).optional(),
}
