import { Status } from '../../entities/status'
import { CategorySummaryNode } from './category'

export interface SubjectConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    categories?: CategorySummaryNode[]
}

export interface SubjectSummaryNode {
    id: string
    name?: string
    status: Status
    system: boolean
}
