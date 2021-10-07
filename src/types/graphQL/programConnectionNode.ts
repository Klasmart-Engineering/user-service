import { Status } from '../../entities/status'
import { AgeRangeConnectionNode } from './ageRangeConnectionNode'
import { GradeSummaryNode } from './gradeSummaryNode'
import { SubjectSummaryNode } from './subjectSummaryNode'

export interface ProgramConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    ageRanges?: AgeRangeConnectionNode[]
    grades?: GradeSummaryNode[]
    subjects?: SubjectSummaryNode[]
}
