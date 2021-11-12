import { Status } from '../../entities/status'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { OrganizationSummaryNode } from './organization'
import { OrganizationMembershipConnectionNode } from './organizationMemberships'
import { RoleSummaryNode } from './role'
import { SchoolSummaryNode } from './school'

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
}

export interface UserSummaryNode {
    id: string
}

export interface UserContactInfo {
    email?: string | null
    phone?: string | null
}
