import { HeaderValidation } from './createEntityHeadersCallback'
import { EntityRow } from './entityRow'

export interface UserRow extends EntityRow {
    user_given_name: string
    user_family_name: string
    user_shortcode?: string
    user_email?: string
    user_phone?: string
    user_date_of_birth?: string
    user_gender: string
    user_alternate_email?: string
    user_alternate_phone?: string
    organization_role_name: string
    school_name?: string
    class_name?: string
}

export const UserRowUniqueColumns = new Set<keyof UserRow>([
    'organization_name',
    'user_given_name',
    'user_family_name',
    'user_shortcode',
    'user_email',
    'user_phone',
    'user_date_of_birth',
    'user_gender',
    'organization_role_name',
    'school_name',
    'class_name',
])

export const UserRowRequiredColumns = new Set<keyof UserRow>([
    'organization_name',
    'user_given_name',
    'user_family_name',
    'user_gender',
    'organization_role_name',
])

export const UserRowEitherRequiredColumns = [
    new Set<keyof UserRow>(['user_email', 'user_phone']),
]

export const UserRowRequirements = new HeaderValidation(
    UserRowUniqueColumns,
    UserRowRequiredColumns,
    UserRowEitherRequiredColumns
)
