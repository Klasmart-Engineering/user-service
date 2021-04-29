import { Status } from '../../entities/status'

export interface OrganizationSummaryNode {
    id: string
    name?: string
    joinDate?: Date
    status: Status
}
