import { sharedValidations } from './shared'
import { REGEX } from './regex'
import Joi from 'joi'
import { config } from '../../config/config'

export const userValidations = {
    user_id: Joi.string().uuid(),

    given_name: sharedValidations.alphanum_with_special_characters
        .required()
        .max(config.limits.USER_GIVEN_NAME_MAX_LENGTH),

    family_name: sharedValidations.alphanum_with_special_characters
        .required()
        .max(config.limits.USER_FAMILY_NAME_MAX_LENGTH),

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
        .max(config.limits.USERNAME_MAX_LEN),

    gender: sharedValidations.alphanum_with_special_characters
        .required()
        .min(config.limits.GENDER_MIN_LENGTH)
        .max(config.limits.GENDER_MAX_LENGTH),

    alternate_email: sharedValidations.email.allow('', null).optional(),

    alternate_phone: sharedValidations.phone.allow('', null).optional(),

    avatar: Joi.string()
        .allow('', null)
        .optional()
        .max(config.limits.AVATAR_MAX_LEN),

    primaryUser: Joi.boolean().optional(),
}
