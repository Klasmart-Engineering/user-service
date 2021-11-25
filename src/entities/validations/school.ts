import Joi from 'joi'
import { config } from '../../config/config'

export const schoolValidations = {
    school_id: Joi.string().uuid().required(),
    school_name: Joi.string().max(config.limits.SCHOOL_NAME_MAX_LENGTH),
}
