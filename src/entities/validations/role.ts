import Joi from 'joi'
import { config } from '../../config/config'

export const roleValidations = {
    role_id: Joi.string().uuid().required(),
    role_name: Joi.string().max(config.limits.ROLE_NAME_MAX_LENGTH),
}
