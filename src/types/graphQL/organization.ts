import { Branding } from '../../entities/branding'
import { Status } from '../../entities/status'
import { CoreClassConnectionNode } from '../../pagination/classesConnection'
import { CoreOrganizationConnectionNode } from '../../pagination/organizationsConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { BrandingInput } from './branding'
import { OrganizationMembershipConnectionNode } from './organizationMemberships'
import { RoleConnectionNode } from './role'
import { ISchoolsConnectionNode } from './school'
import { UserSummaryNode } from './user'

export interface CreateOrganizationInput {
    userId: string
    organizationName: string
    address1?: string
    address2?: string
    phone?: string
    shortcode?: string
}

export interface UpdateOrganizationInput {
    id: string
    organizationName?: string
    address1?: string
    address2?: string
    phone?: string
    shortcode?: string
    primaryContactId?: string
    branding?: BrandingInput
}

export interface AddUsersToOrganizationInput {
    organizationId: string
    userIds: string[]
    organizationRoleIds: string[]
    shortcode?: string
}

export interface RemoveUsersFromOrganizationInput {
    organizationId: string
    userIds: string[]
}

export interface ReactivateUsersFromOrganizationInput {
    organizationId: string
    userIds: string[]
}

export interface DeleteUsersFromOrganizationInput {
    organizationId: string
    userIds: string[]
}

export interface ActivateUsersInOrganizationInput {
    organizationId: string
    userIds: string[]
}

export interface OrganizationConnectionNode {
    id: string
    name?: string
    contactInfo: OrganizationContactInfo
    shortCode?: string
    status: Status

    owners?: UserSummaryNode[]
    branding?: Branding

    organizationMembershipsConnection?: IPaginatedResponse<OrganizationMembershipConnectionNode>
    schoolsConnection?: IPaginatedResponse<ISchoolsConnectionNode>
    rolesConnection?: IPaginatedResponse<RoleConnectionNode>
    classesConnection?: IPaginatedResponse<CoreClassConnectionNode>
}

export interface OrganizationContactInfo {
    address1?: string | null
    address2?: string | null
    phone?: string | null
}

export interface OrganizationSummaryNode {
    id: string
    name?: string
    joinDate?: Date
    userStatus: Status
    status?: Status
    userShortCode?: string
}

export interface OrganizationsMutationResult {
    organizations: CoreOrganizationConnectionNode[]
}

export interface DeleteOrganizationInput {
    id: string
}
