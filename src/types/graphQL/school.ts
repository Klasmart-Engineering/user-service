import { Status } from '../../entities/status'

export interface ISchoolsConnectionNode {
    id: string
    name: string
    status: Status
    shortCode?: string
    organizationId: string
}

export interface SchoolSummaryNode {
    id: string
    name?: string
    organizationId: string
    status?: Status
    userStatus?: Status
}
