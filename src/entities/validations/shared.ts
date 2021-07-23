import Joi from 'joi'
import validationConstants from './constants'
import { REGEX } from './regex'

export const sharedValidations = {
    shortcode: Joi.string()
        .alphanum()
        .max(validationConstants.SHORTCODE_MAX_LENGTH),

    alphanum_with_special_characters: Joi.string().regex(
        REGEX.alphanum_with_special_characters,
        {
            name: 'alphanum_with_special_characters',
        }
    ),
}
