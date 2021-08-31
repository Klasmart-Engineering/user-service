import { Status } from '../../entities/status'

export interface UserRawNode {
    user_id: string
    given_name: string
    family_name: string
    email: string
    phone: string
    status: Status
    permission: string
}
