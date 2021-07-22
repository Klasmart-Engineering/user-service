import Joi from 'joi'
import validationConstants from './constants'

export const organizationValidations = {
    organization_name: Joi.string().max(
        validationConstants.ORGANIZATION_NAME_MAX_LENGTH
    ),
}
