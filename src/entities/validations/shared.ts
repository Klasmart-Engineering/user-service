import Joi from 'joi'
import { config } from '../../config/config'
import clean from '../../utils/clean'
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
    phone: Joi.string().custom((value, helpers) => {
        if (
            typeof value !== 'string' &&
            value !== null &&
            value !== undefined
        ) {
            return helpers.error('string.pattern.name', { name: 'phone' })
        }

        let normalized: string | null | undefined
        try {
            normalized = clean.phone(value)
        } catch {
            return helpers.error('string.pattern.name', { name: 'phone' })
        }
        if (
            normalized !== null &&
            normalized !== undefined &&
            !REGEX.phone.test(normalized)
        ) {
            return helpers.error('string.pattern.name', { name: 'phone' })
        }
        return normalized
    }),
    base64: Joi.string().base64(),
}
