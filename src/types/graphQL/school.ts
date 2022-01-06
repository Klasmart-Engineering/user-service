import { Status } from '../../entities/status'
import { CoreClassConnectionNode } from '../../pagination/classesConnection'
import { CoreProgramConnectionNode } from '../../pagination/programsConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { SchoolMembershipConnectionNode } from './schoolMembership'

export interface ISchoolsConnectionNode {
    id: string
    name: string
    status: Status
    shortCode?: string
    organizationId: string

    schoolMembershipsConnection?: IPaginatedResponse<SchoolMembershipConnectionNode>
    classesConnection?: IPaginatedResponse<CoreClassConnectionNode>
    programsConnection?: IPaginatedResponse<CoreProgramConnectionNode>
}

export interface SchoolSummaryNode {
    id: string
    name?: string
    organizationId: string
    status?: Status
    userStatus?: Status
}

export interface CreateSchoolInput {
    name: string
    shortCode?: string
    organizationId: string
}

export interface UpdateSchoolInput {
    id: string
    organizationId: string
    name: string
    shortCode: string
}

export interface DeleteSchoolInput {
    id: string
}

export interface AddUsersToSchoolInput {
    schoolId: string
    schoolRoleIds: string[]
    userIds: string[]
}

export interface RemoveUsersFromSchoolInput {
    schoolId: string
    userIds: string[]
}

export interface AddClassesToSchoolInput {
    schoolId: string
    classIds: string[]
}

export interface SchoolsMutationResult {
    schools: ISchoolsConnectionNode[]
}

export interface AddProgramsToSchoolInput {
    schoolId: string
    programIds: string[]
}

export interface RemoveProgramsFromSchoolInput {
    schoolId: string
    programIds: string[]
}
