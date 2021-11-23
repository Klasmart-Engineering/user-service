import Joi from 'joi'
import { config } from '../../config/config'
import { REGEX } from './regex'

export const sharedValidations = {
    shortcode: Joi.string().alphanum().max(config.limits.SHORTCODE_MAX_LENGTH),

    alphanum_with_special_characters: Joi.string().regex(
        REGEX.alphanum_with_special_characters,
        {
            name: 'alphanum_with_special_characters',
        }
    ),
    email: Joi.string()
        .regex(REGEX.email, {
            name: 'email',
        })
        .max(config.limits.EMAIL_MAX_LENGTH),
    phone: Joi.string().regex(REGEX.phone, {
        name: 'phone',
    }),
    base64: Joi.string().base64(),
}
