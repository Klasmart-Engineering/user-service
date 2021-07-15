import Joi from 'joi'
import validationConstants from './constants'
import { sharedValidations } from './shared'
import { REGEX } from './regex'

export const userValidations = {
    given_name: sharedValidations.alphanum_with_special_characters
        .required()
        .max(validationConstants.USER_GIVEN_NAME_MAX_LENGTH),

    family_name: sharedValidations.alphanum_with_special_characters
        .required()
        .max(validationConstants.USER_FAMILY_NAME_MAX_LENGTH),

    email: Joi.string()
        .regex(REGEX.email, {
            name: 'email',
        })
        .max(validationConstants.EMAIL_MAX_LENGTH)
        .empty(null)
        .when('phone', {
            is: Joi.exist(),
            then: Joi.optional().allow('', null),
            otherwise: Joi.required().messages({
                'any.required': 'email/phone is required',
            }),
        }),

    phone: Joi.string().allow(null, '').empty(null).regex(REGEX.phone, {
        name: 'phone',
    }),

    date_of_birth: Joi.string().allow(null, '').regex(REGEX.dob, {
        name: 'date_mm_yyy',
    }),

    gender: sharedValidations.alphanum_with_special_characters
        .required()
        .min(validationConstants.GENDER_MIN_LENGTH)
        .max(validationConstants.GENDER_MAX_LENGTH),

    alternate_email: Joi.string()
        .regex(REGEX.email, {
            name: 'email',
        })
        .max(validationConstants.EMAIL_MAX_LENGTH)
        .optional(),

    alternate_phone: Joi.string().allow(null).regex(REGEX.phone, {
        name: 'phone',
    }),
}
