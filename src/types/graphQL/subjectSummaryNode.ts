import { Status } from '../../entities/status'

export interface SubjectSummaryNode {
    id: string
    name?: string
    status: Status
}
