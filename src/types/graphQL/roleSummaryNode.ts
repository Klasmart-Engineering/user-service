import { Status } from '../../entities/status'

export interface RoleSummaryNode {
    id: string
    name?: string
    organizationId?: string
    schoolId?: string
    status: Status
}
