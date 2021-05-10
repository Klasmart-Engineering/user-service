import { Status } from '../../entities/status'

export interface SchoolSummaryNode {
    id: string
    name?: string
    organizationId: string
    status: Status
    userStatus: Status
}
