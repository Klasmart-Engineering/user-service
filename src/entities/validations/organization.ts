import Joi from 'joi'
import { config } from '../../config/config'

export const organizationValidations = {
    organization_name: Joi.string().max(
        config.limits.ORGANIZATION_NAME_MAX_LENGTH
    ),
}
