import { EntityRow } from './entityRow'

export interface OrganizationRow extends EntityRow {
    owner_given_name: string
    owner_family_name: string
    owner_shortcode: string
    owner_email: string
    owner_phone: string
}
