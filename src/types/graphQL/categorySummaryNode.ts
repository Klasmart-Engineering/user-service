import { Status } from '../../entities/status'

export interface CategorySummaryNode {
    id: string
    name?: string
    status: Status
    system: boolean
}
