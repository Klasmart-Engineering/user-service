import { Status } from '../../entities/status'
import { CoreClassConnectionNode } from '../../pagination/classesConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { SchoolMembershipConnectionNode } from './schoolMembership'

export interface ISchoolsConnectionNode {
    id: string
    name: string
    status: Status
    shortCode?: string
    organizationId: string

    schoolMembershipsConnection?: IPaginatedResponse<SchoolMembershipConnectionNode>
    classesConnection?: IPaginatedResponse<CoreClassConnectionNode>
}

export interface SchoolSummaryNode {
    id: string
    name?: string
    organizationId: string
    status?: Status
    userStatus?: Status
}
