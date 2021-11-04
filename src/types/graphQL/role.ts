import { Status } from '../../entities/status'

export interface RoleConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    description: string
}

export interface RoleSummaryNode {
    id: string
    name?: string
    organizationId?: string
    schoolId?: string
    status: Status
}
