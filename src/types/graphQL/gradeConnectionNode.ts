import { Status } from '../../entities/status'
import { GradeSummaryNode } from './gradeSummaryNode'

export interface GradeConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    fromGrade: GradeSummaryNode
    toGrade: GradeSummaryNode
}
