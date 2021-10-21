import { Status } from '../../entities/status'
import { Branding } from '../../entities/branding'
import { OrganizationContactInfo } from './organizationContactInfo'
import { UserSummaryNode } from './userSummaryNode'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { ISchoolsConnectionNode } from './schoolsConnectionNode'
import { UserConnectionNode } from './userConnectionNode'

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
