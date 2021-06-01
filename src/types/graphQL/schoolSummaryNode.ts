import { Status } from '../../entities/status'

export interface SchoolSummaryNode {
    // FIXES #KL-4862: Must be named `schoolId` over `id` for valid apollo-client caching
    schoolId: string
    name?: string
    organizationId: string
    status?: Status
    userStatus: Status
}
