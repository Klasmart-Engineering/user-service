import { Status } from '../../entities/status'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { PermissionConnectionNode } from './permission'

export interface RoleConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    description: string
    permissionsConnection?: IPaginatedResponse<PermissionConnectionNode>
}

export interface RoleSummaryNode {
    id: string
    name?: string
    organizationId?: string
    schoolId?: string
    status: Status
}

export interface CreateRoleInput {
    organizationId: string
    roleName: string
    roleDescription: string
}

export interface DeleteRoleInput {
    id: string
}

export interface RolesMutationResult {
    roles: RoleConnectionNode[]
}
