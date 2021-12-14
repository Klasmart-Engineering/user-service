import { EntityRow } from './entityRow'

export interface RoleRow extends EntityRow {
    role_name: string
    permission_id: string
}
