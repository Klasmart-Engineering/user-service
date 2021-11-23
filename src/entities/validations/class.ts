import Joi from 'joi'
import { config } from '../../config/config'

export const classValidations = {
    class_name: Joi.string().max(config.limits.CLASS_NAME_MAX_LENGTH),
}
