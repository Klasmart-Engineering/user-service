import { Status } from '../../entities/status'
import { AgeRangeSummaryNode } from './ageRangeSummaryNode'
import { GradeSummaryNode } from './gradeSummaryNode'
import { SubjectSummaryNode } from './subjectSummaryNode'

export interface ProgramConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    ageRanges?: AgeRangeSummaryNode[]
    grades?: GradeSummaryNode[]
    subjects?: SubjectSummaryNode[]
}
