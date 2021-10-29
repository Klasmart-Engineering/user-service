import { Status } from '../../entities/status'

export interface ISchoolsConnectionNode {
    id: string
    name?: string
    status?: Status
    shortCode?: string
    organizationId?: string
}
