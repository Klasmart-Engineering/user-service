import { Status } from '../../entities/status'
import { Branding } from '../../entities/branding'
import { OrganizationContactInfo } from './organizationContactInfo'
import { UserSummaryNode } from './userSummaryNode'

export interface OrganizationConnectionNode {
    id: string
    name?: string
    contactInfo: OrganizationContactInfo
    shortCode?: string
    status: Status

    owners: UserSummaryNode[]
    branding: Branding
}
