import { Status } from '../../entities/status'
import { Branding } from '../../entities/branding'
import { OrganizationContactInfo } from './organizationContactInfo'
import { UserSummaryNode } from './userSummaryNode'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { CoreUserConnectionNode } from '../../pagination/usersConnection'
import { ISchoolsConnectionNode } from './schoolsConnectionNode'

export interface OrganizationConnectionNode {
    id: string
    name?: string
    contactInfo: OrganizationContactInfo
    shortCode?: string
    status: Status

    owners: UserSummaryNode[]
    branding: Branding

    usersConnection?: IPaginatedResponse<CoreUserConnectionNode>
    schoolsConnection?: IPaginatedResponse<ISchoolsConnectionNode>
}
