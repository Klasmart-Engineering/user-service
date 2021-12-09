import { Status } from '../../entities/status'
import { CoreSubjectConnectionNode } from '../../pagination/subjectsConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { AgeRangeConnectionNode } from './ageRange'
import { GradeSummaryNode } from './grade'

export interface ProgramConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    ageRanges?: AgeRangeConnectionNode[]
    grades?: GradeSummaryNode[]
    subjects?: CoreSubjectConnectionNode[]

    subjectsConnection?: IPaginatedResponse<CoreSubjectConnectionNode>
}
