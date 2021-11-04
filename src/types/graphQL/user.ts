import { Status } from '../../entities/status'
import { OrganizationSummaryNode } from './organization'
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
}

export interface UserSummaryNode {
    id: string
}

export interface UserContactInfo {
    email?: string | null
    phone?: string | null
}
