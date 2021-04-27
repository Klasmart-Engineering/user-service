import { Status } from '../../entities/status'

export interface OrganizationSummaryItem {
    id: string
    name: string
    joinDate: Date
    status: Status
}
