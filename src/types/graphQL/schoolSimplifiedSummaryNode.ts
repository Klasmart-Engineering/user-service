import { Status } from '../../entities/status'

export interface SchoolSimplifiedSummaryNode {
    id: string
    name?: string
    status: Status
}
