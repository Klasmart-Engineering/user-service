import Joi from 'joi'
import { roleValidations } from './role'

export const schoolMembershipValidations = {
    roles: Joi.array().items(roleValidations.role_id.optional()).optional(),
}
