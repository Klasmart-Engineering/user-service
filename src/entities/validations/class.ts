import Joi from 'joi'
import validationConstants from './constants'

export const classValidations = {
    class_name: Joi.string().max(validationConstants.CLASS_NAME_MAX_LENGTH),
}
