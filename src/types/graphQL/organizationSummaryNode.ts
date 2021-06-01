import { Status } from '../../entities/status'

export interface OrganizationSummaryNode {
    // FIXES #KL-4862: Must be named `organizationId` over `id` for valid apollo-client caching
    organizationId: string
    name?: string
    joinDate?: Date
    userStatus: Status
    status?: Status
}
