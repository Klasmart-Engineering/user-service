import { sharedValidations } from './shared'

export const organizationMembershipValidations = {
    shortcode: sharedValidations.shortcode.allow(null).optional(),
}
