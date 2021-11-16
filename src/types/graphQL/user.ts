import { Status } from '../../entities/status'
import { CoreClassConnectionNode } from '../../pagination/classesConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { OrganizationSummaryNode } from './organization'
import { OrganizationMembershipConnectionNode } from './organizationMemberships'
import { RoleSummaryNode } from './role'
import { ISchoolsConnectionNode, SchoolSummaryNode } from './school'

export interface UserConnectionNode {
    id: string
    givenName?: string
    familyName?: string
    avatar?: string
    contactInfo: UserContactInfo
    alternateContactInfo?: UserContactInfo
    organizations: OrganizationSummaryNode[]
    roles: RoleSummaryNode[]
    schools: SchoolSummaryNode[]
    status: Status
    dateOfBirth?: string
    gender?: string

    organizationMembershipsConnection?: IPaginatedResponse<OrganizationMembershipConnectionNode>
    schoolsConnection?: IPaginatedResponse<ISchoolsConnectionNode>
    classesConnection?: IPaginatedResponse<CoreClassConnectionNode>
}

export interface UserSummaryNode {
    id: string
}

export interface UserContactInfo {
    email?: string | null
    phone?: string | null
}
