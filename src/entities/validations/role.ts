import Joi from 'joi'
import validationConstants from './constants'

export const roleValidations = {
    role_name: Joi.string().max(validationConstants.ROLE_NAME_MAX_LENGTH),
}
