import Joi from 'joi'
import { roleValidations } from './role'
import { sharedValidations } from './shared'

export const organizationMembershipValidations = {
    shortcode: sharedValidations.shortcode.allow(null, '').optional(),
    roles: Joi.array().items(roleValidations.role_id).required(),
}
