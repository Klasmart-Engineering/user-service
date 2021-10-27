import { Status } from '../../entities/status'

export interface RoleConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    description: string
}
