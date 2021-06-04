import { Status } from '../../entities/status'

export interface RoleSummaryNode {
    roleId: string
    name?: string
    organizationId?: string
    schoolId?: string
    status: Status
}
