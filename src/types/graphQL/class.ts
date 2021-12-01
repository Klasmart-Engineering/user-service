import { Status } from '../../entities/status'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { AgeRangeConnectionNode } from './ageRange'
import { GradeSummaryNode } from './grade'
import { ProgramSummaryNode } from './program'
import { SchoolSummaryNode } from './school'
import { SubjectSummaryNode } from './subject'
import { UserConnectionNode } from './user'
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

    studentsConnection?: IPaginatedResponse<UserConnectionNode>
    teachersConnection?: IPaginatedResponse<UserConnectionNode>
}

export interface DeleteClassInput {
    id: string
}

export interface ClassesMutationResult {
    classes: ClassConnectionNode[]
}
