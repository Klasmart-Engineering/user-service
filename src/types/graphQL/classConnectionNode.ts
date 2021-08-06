import { Status } from '../../entities/status'
import { AgeRangeConnectionNode } from './ageRangeConnectionNode'
import { GradeSummaryNode } from './gradeSummaryNode'
import { ProgramSummaryNode } from './programSummaryNode'
import { SchoolSimplifiedSummaryNode } from './schoolSimplifiedSummaryNode'
import { SubjectSummaryNode } from './subjectSummaryNode'

export interface ClassConnectionNode {
    id: string
    name?: string
    status: Status
    schools?: SchoolSimplifiedSummaryNode[]
    ageRanges?: AgeRangeConnectionNode[]
    grades?: GradeSummaryNode[]
    subjects?: SubjectSummaryNode[]
    programs?: ProgramSummaryNode[]
}
