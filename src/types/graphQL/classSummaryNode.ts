import { Status } from '../../entities/status'

export interface ClassSummaryNode {
    id: string
    name?: string
    status: Status
    shortCode?: string
}
