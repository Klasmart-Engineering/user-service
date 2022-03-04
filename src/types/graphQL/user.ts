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
    username?: string
    gender?: string

    organizationMembershipsConnection?: IPaginatedResponse<OrganizationMembershipConnectionNode>
    schoolMembershipsConnection?: IPaginatedResponse<SchoolMembershipConnectionNode>
    classesStudyingConnection?: IPaginatedResponse<ClassConnectionNode>
    classesTeachingConnection?: IPaginatedResponse<ClassConnectionNode>
}

export interface UserSummaryNode {
    id: string
    email: string
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
export type RemoveOrganizationRolesFromUserInput = AddOrganizationRolesToUserInput

export interface AddSchoolRolesToUserInput {
    userId: string
    schoolId: string
    roleIds: string[]
}
export type RemoveSchoolRolesFromUserInput = AddSchoolRolesToUserInput

export interface UsersMutationResult {
    users: CoreUserConnectionNode[]
}
export interface CreateUserInput {
    givenName: string
    familyName: string
    contactInfo?: UserContactInfo
    dateOfBirth?: string
    username?: string | null
    gender: string
    alternateEmail?: string | null
    alternatePhone?: string | null
}

export interface UpdateUserInput {
    id: string
    givenName?: string
    familyName?: string
    email?: string
    phone?: string
    username?: string
    dateOfBirth?: string
    gender?: string
    avatar?: string
    alternateEmail?: string
    alternatePhone?: string
    primaryUser?: boolean
}

export interface UpdateOrganizationUserInput {
    organizationId: string
    members: UpdateOrganizationUserInputElement[]
}

export interface UpdateOrganizationUserInputElement {
    status: Status
    userId: string
    roleIds?: string[]
    schoolIds?: string[]
    classIds?: string[]
    academicYear: string
}
