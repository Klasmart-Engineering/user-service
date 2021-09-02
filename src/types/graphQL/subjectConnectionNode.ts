import { Status } from '../../entities/status'
import { CategorySummaryNode } from './categorySummaryNode'

export interface SubjectConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    categories?: CategorySummaryNode[]
}
