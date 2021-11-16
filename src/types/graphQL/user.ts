import { Status } from '../../entities/status'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { ClassConnectionNode } from './class'
import { CoreUserConnectionNode } from '../../pagination/usersConnection'
import { OrganizationSummaryNode } from './organization'
import { OrganizationMembershipConnectionNode } from './organizationMemberships'
import { RoleSummaryNode } from './role'
import { SchoolSummaryNode } from './school'
import { SchoolMembershipConnectionNode } from './schoolMembership'

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
    schoolMembershipsConnection?: IPaginatedResponse<SchoolMembershipConnectionNode>
    classesStudyingConnection?: IPaginatedResponse<ClassConnectionNode>
    classesTeachingConnection?: IPaginatedResponse<ClassConnectionNode>
}

export interface UserSummaryNode {
    id: string
}

export interface UserContactInfo {
    email?: string | null
    phone?: string | null
}

export interface AddOrganizationRolesToUserInput {
    userId: string
    organizationId: string
    roleIds: string[]
}

export interface RemoveOrganizationRolesFromUserInput {
    userId: string
    organizationId: string
    roleIds: string[]
}

export interface UsersMutationResult {
    users: CoreUserConnectionNode[]
}
