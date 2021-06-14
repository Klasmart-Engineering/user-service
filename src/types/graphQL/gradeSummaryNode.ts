import { Status } from '../../entities/status'

export interface GradeSummaryNode {
    id: string
    name?: string
    status: Status
    system: boolean
}
