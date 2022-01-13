import Joi from 'joi'
import { config } from '../../../config/config'

export const validations = {
    uuid: Joi.string().uuid().required(),
    uuids: Joi.array()
        .items(Joi.string().uuid())
        .unique()
        .min(config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE)
        .max(config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
        .required(),
}
