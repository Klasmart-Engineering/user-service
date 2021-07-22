import Joi from 'joi'
import validationConstants from './constants'

export const schoolValidations = {
    school_name: Joi.string().max(validationConstants.SCHOOL_NAME_MAX_LENGTH),
}
