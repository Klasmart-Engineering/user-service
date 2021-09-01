import { User } from '../../entities/user'

export interface UserWithPermissionId extends User {
    permission_id?: string
}
