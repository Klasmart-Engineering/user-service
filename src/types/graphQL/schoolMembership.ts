import { Status } from '../../entities/status'
import { ISchoolsConnectionNode } from './school'
import { UserConnectionNode } from './user'

export interface SchoolMembershipConnectionNode {
    userId: string
    schoolId: string
    status: Status
    joinTimestamp?: Date
    user?: UserConnectionNode
    school?: ISchoolsConnectionNode
}
