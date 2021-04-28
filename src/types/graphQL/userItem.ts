import { Status } from '../../entities/status'
import { ContactInfo } from './contactInfo'
import { OrganizationSummaryItem } from './organizationSummaryItem'
import { RoleSummaryItem } from './roleSummaryItem'
import { SchoolSummaryItem } from './schoolSummaryItem'

export interface UserItem {
    id: string
    givenName: string
    familyName: string
    avatar: string
    contactInfo: ContactInfo
    organizations: OrganizationSummaryItem[]
    roles: RoleSummaryItem[]
    schools: SchoolSummaryItem[]
    status: Status
}
