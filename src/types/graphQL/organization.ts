import { BrandingInput } from './branding'
import { Status } from '../../entities/status'
import { Branding } from '../../entities/branding'
import { UserConnectionNode, UserSummaryNode } from './user'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { ISchoolsConnectionNode } from './school'

export interface CreateOrganizationInput {
    userId: string
    organizationName: string
    address1?: string
    address2?: string
    phone?: string
    shortcode?: string
    branding?: BrandingInput
}

export interface OrganizationConnectionNode {
    id: string
    name?: string
    contactInfo: OrganizationContactInfo
    shortCode?: string
    status: Status

    owners: UserSummaryNode[]
    branding: Branding

    usersConnection?: IPaginatedResponse<UserConnectionNode>
    schoolsConnection?: IPaginatedResponse<ISchoolsConnectionNode>
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
