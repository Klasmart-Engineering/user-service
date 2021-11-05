import { Status } from '../../entities/status'
import { AgeRangeConnectionNode } from './ageRange'
import { GradeSummaryNode } from './grade'
import { ProgramSummaryNode } from './program'
import { SchoolSummaryNode } from './school'
import { SubjectSummaryNode } from './subject'

export interface ClassConnectionNode {
    id: string
    name?: string
    status: Status
    shortCode?: string
    schools?: SchoolSummaryNode[]
    ageRanges?: AgeRangeConnectionNode[]
    grades?: GradeSummaryNode[]
    subjects?: SubjectSummaryNode[]
    programs?: ProgramSummaryNode[]
}
