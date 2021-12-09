import { Status } from '../../entities/status'
import { CoreSubjectConnectionNode } from '../../pagination/subjectsConnection'
import { CoreProgramConnectionNode } from '../../pagination/programsConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { AgeRangeConnectionNode } from './ageRange'
import { GradeSummaryNode } from './grade'
import { SchoolSummaryNode } from './school'
import { UserConnectionNode } from './user'
export interface ClassConnectionNode {
    id: string
    name?: string
    status: Status
    shortCode?: string
    schools?: SchoolSummaryNode[]
    ageRanges?: AgeRangeConnectionNode[]
    grades?: GradeSummaryNode[]
    subjects?: CoreSubjectConnectionNode[]
    programs?: CoreProgramConnectionNode[]

    studentsConnection?: IPaginatedResponse<UserConnectionNode>
    teachersConnection?: IPaginatedResponse<UserConnectionNode>
    subjectsConnection?: IPaginatedResponse<CoreSubjectConnectionNode>
    programsConnection?: IPaginatedResponse<CoreProgramConnectionNode>
}

export interface DeleteClassInput {
    id: string
}

export interface ClassesMutationResult {
    classes: ClassConnectionNode[]
}
