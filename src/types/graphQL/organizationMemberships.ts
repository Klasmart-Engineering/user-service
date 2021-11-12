import { Status } from '../../entities/status'
import { OrganizationConnectionNode } from './organization'
import { UserConnectionNode } from './user'

export interface OrganizationMembershipConnectionNode {
    userId: string
    organizationId: string
    shortCode: string
    status: Status
    joinTimestamp?: Date
    user?: UserConnectionNode
    organization?: OrganizationConnectionNode
}
