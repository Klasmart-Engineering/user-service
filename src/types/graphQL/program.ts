import { Status } from '../../entities/status'
import { AgeRangeConnectionNode } from './ageRange'
import { GradeSummaryNode } from './grade'
import { SubjectSummaryNode } from './subject'

export interface ProgramConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    ageRanges?: AgeRangeConnectionNode[]
    grades?: GradeSummaryNode[]
    subjects?: SubjectSummaryNode[]
}

export interface ProgramSummaryNode {
    id: string
    name?: string
    status: Status
    system: boolean
}
