import { Status } from '../../entities/status'
import { CoreProgramConnectionNode } from '../../pagination/programsConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { AgeRangeConnectionNode } from './ageRange'
import { GradeSummaryNode } from './grade'
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
    programs?: CoreProgramConnectionNode[]

    studentsConnection?: IPaginatedResponse<UserConnectionNode>
    teachersConnection?: IPaginatedResponse<UserConnectionNode>
    programsConnection?: IPaginatedResponse<CoreProgramConnectionNode>
}

export interface DeleteClassInput {
    id: string
}

export interface ClassesMutationResult {
    classes: ClassConnectionNode[]
}
