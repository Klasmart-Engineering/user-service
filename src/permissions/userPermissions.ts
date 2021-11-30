import { getRepository } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { User } from '../entities/user'
import { SchoolMembership } from '../entities/schoolMembership'
import { Status } from '../entities/status'
import { PermissionName } from './permissionNames'
import { superAdminRole } from './superAdmin'

interface PermissionContext {
    school_ids?: string[]
    organization_id?: string
    user_id?: string
}

export class UserPermissions {
    static ADMIN_EMAILS = [
        'sandy@calmid.com',
        'pj.williams@calmid.com',
        'emfg@calmid.com',
        'owen.delahoy@calmid.com',
        'mcarey@calmid.com',
        'ncurtis@calmid.com',
        'sbrolia@calmid.com',
        'nicolasc@bluetrailsoft.com'
    ]

    private _organizationPermissions?: Promise<Map<string, Set<string>>>
    private _schoolPermissions?: Promise<Map<string, Set<string>>>

    private readonly user_id?: string
    private readonly email?: string
    private readonly phone?: string
    public readonly isAdmin?: boolean

    public constructor(token?: { id: string; email?: string; phone?: string }) {
        this.user_id = token?.id
        if (typeof token?.email == 'string' && token?.email?.length > 0) {
            this.email = token.email
            this.isAdmin = this.isAdminEmail(this.email!)
        } else {
            this.isAdmin = false
        }
        if (typeof token?.phone == 'string' && token?.phone?.length > 0) {
            this.phone = token?.phone
        }
    }

    private isAdminEmail(email: string) {
        return UserPermissions.ADMIN_EMAILS.includes(email)
    }

    public getUserId() {
        return this.user_id
    }

    public getEmail() {
        return this.email
    }

    public getPhone() {
        return this.phone
    }

    private async isUserAdmin(user_id?: string) {
        const user = await User.findOne({ user_id })

        return this.isAdminEmail(user?.email || '')
    }

    public rejectIfNotAdmin() {
        if (!this.isAdmin) {
            throw new Error(
                `User(${this.user_id}) does not have Admin permissions`
            )
        }
    }

    public rejectIfNotAuthenticated() {
        if (!this.user_id) {
            throw new Error(
                `User not authenticated. Please authenticate to proceed`
            )
        }
    }

    private async getUserIsActive(
        userId: string | undefined
    ): Promise<boolean> {
        if (!userId) {
            return false
        }
        const user = await getRepository(User).findOne(userId)

        return user?.status === Status.ACTIVE
    }

    public async rejectIfNotAllowed(
        { school_ids, organization_id }: PermissionContext,
        permission_name: PermissionName
    ) {
        const isActive = await this.getUserIsActive(this.user_id)
        if (!isActive) {
            throw new Error(
                `User(${this.user_id}) has been deleted, so does not have Permission(${permission_name}) in Organization(${organization_id})`
            )
        }

        const isAllowed = await this.allowed(
            { school_ids, organization_id, user_id: this.user_id },
            permission_name
        )

        if (!isAllowed && organization_id) {
            throw new Error(
                `User(${this.user_id}) does not have Permission(${permission_name}) in Organization(${organization_id})`
            )
        }

        if (!isAllowed && school_ids) {
            throw new Error(
                `User(${
                    this.user_id
                }) does not have Permission(${permission_name}) in Schools(${school_ids?.toString()})`
            )
        }

        if (!isAllowed) {
            throw new Error(
                `User(${this.user_id}) does not have Permission(${permission_name})`
            )
        }
    }

    public async allowed(
        { school_ids, organization_id, user_id }: PermissionContext,
        permission_name: PermissionName
    ) {
        const isActive = await this.getUserIsActive(user_id)

        if (!isActive) {
            return false
        }

        const isAdmin = await this.isUserAdmin(user_id)
        let output =
            isAdmin && superAdminRole.permissions.includes(permission_name)

        if (!output && organization_id) {
            const allOrganizationPermissions = await this.organizationPermissions(
                user_id
            )
            const organizationPermissions = allOrganizationPermissions.get(
                organization_id
            )
            if (
                organizationPermissions &&
                organizationPermissions.has(permission_name)
            ) {
                output = true
            }
        }

        if (!output && school_ids) {
            const allSchoolPermissions = await this.schoolPermissions(user_id)
            for (const id of school_ids) {
                const schoolPermissions = allSchoolPermissions.get(id)
                if (
                    schoolPermissions &&
                    schoolPermissions.has(permission_name)
                ) {
                    output = true
                    break
                }
            }
        }

        return output
    }

    public async organizationsWhereItIsAllowed(
        organizationIds: string[],
        permissionName: string
    ): Promise<string[]> {
        const isActive = await this.getUserIsActive(this.user_id)
        if (!isActive) {
            return []
        }
        const orgsWithPermission: string[] = []
        const allOrganizationPermisions = await this.organizationPermissions(
            this.user_id
        )
        for (const orgId of organizationIds) {
            const organizationPermissions = allOrganizationPermisions.get(orgId)
            if (
                organizationPermissions &&
                organizationPermissions.has(permissionName)
            ) {
                orgsWithPermission.push(orgId)
            }
        }
        return orgsWithPermission
    }

    private async organizationPermissions(
        user_id?: string
    ): Promise<Map<string, Set<string>>> {
        if (!this._organizationPermissions) {
            const organizationPermissions = new Map<string, Set<string>>()
            if (!user_id) {
                this._organizationPermissions = Promise.resolve(
                    organizationPermissions
                )
                return this._organizationPermissions
            }

            //TODO: Adjust for returning explicity denial
            // const organizationPermissionResults =
            this._organizationPermissions = getRepository(
                OrganizationMembership
            )
                .createQueryBuilder('OrganizationMembership')
                .select(
                    'OrganizationMembership.organization_id, Permission.permission_name'
                )
                .distinct(true)
                .leftJoin(
                    'OrganizationMembership.roles',
                    'Role',
                    'Role.status = :status',
                    {
                        status: Status.ACTIVE,
                    }
                )
                .leftJoin(
                    'Role.permissions',
                    'Permission',
                    'Permission.allow = :allowed',
                    {
                        allowed: true,
                    }
                )
                .where('OrganizationMembership.user_id = :user_id', {
                    user_id,
                })
                .getRawMany()
                .then((organizationPermissionResults) => {
                    for (const {
                        organization_id,
                        permission_id,
                    } of organizationPermissionResults) {
                        let permissions = organizationPermissions.get(
                            organization_id
                        )
                        if (!permissions) {
                            permissions = new Set()
                            organizationPermissions.set(
                                organization_id,
                                permissions
                            )
                        }
                        if (permission_id) {
                            permissions.add(permission_id)
                        }
                    }
                    return organizationPermissions
                })
        }
        return this._organizationPermissions
    }

    private async schoolPermissions(
        user_id?: string
    ): Promise<Map<string, Set<string>>> {
        if (!this._schoolPermissions) {
            const schoolPermissions = new Map<string, Set<string>>()
            if (!user_id) {
                return Promise.resolve(schoolPermissions)
            }
            //TODO: Adjust for returning explicity denial
            this._schoolPermissions = getRepository(SchoolMembership)
                .createQueryBuilder()
                .select(
                    'SchoolMembership.school_id, Permission.permission_name'
                )
                .distinct(true)
                .leftJoin(
                    'SchoolMembership.roles',
                    'Role',
                    'Role.status = :status',
                    {
                        status: Status.ACTIVE,
                    }
                )
                .leftJoin(
                    'Role.permissions',
                    'Permission',
                    'Permission.allow = :allowed',
                    {
                        allowed: true,
                    }
                )
                .where('SchoolMembership.user_id = :user_id', {
                    user_id,
                })
                .getRawMany()
                .then((schoolPermissionResults) => {
                    for (const {
                        school_id,
                        permission_id,
                    } of schoolPermissionResults) {
                        const permissions = schoolPermissions.get(school_id)
                        if (permissions) {
                            permissions.add(permission_id)
                        } else {
                            schoolPermissions.set(
                                school_id,
                                new Set([permission_id])
                            )
                        }
                    }
                    return schoolPermissions
                })
        }
        return this._schoolPermissions
    }

    // Fetches organizations through which user has the given permissions
    // 'AND' = all given permissions must exist in each organization membership
    // 'OR' = any of the given permissions must exist in each organization membership
    // Returns all user's organizations if no specific permissions are supplied
    public async orgMembershipsWithPermissions(
        requiredPermissions: PermissionName[],
        operator: 'AND' | 'OR' = 'AND'
    ): Promise<string[]> {
        const orgIds: string[] = []
        const orgPermissions = await this.organizationPermissions(this.user_id)

        if (requiredPermissions.length === 0) {
            return Array.from(orgPermissions.keys())
        }

        for (const [orgId, permissions] of orgPermissions) {
            let hasRequiredPerms = operator === 'AND' ? true : false
            for (const p of requiredPermissions) {
                if (operator === 'OR') {
                    hasRequiredPerms = hasRequiredPerms || permissions.has(p)
                } else {
                    hasRequiredPerms = hasRequiredPerms && permissions.has(p)
                }
            }
            if (hasRequiredPerms) {
                orgIds.push(orgId)
            }
        }

        return orgIds
    }

    // Fetches schools through which user has the given permissions
    // 'AND' = all given permissions must exist in each school membership
    // 'OR' = any of the given permissions must exist in each school membership
    // Returns all user's schools if no specific permissions are supplied
    public async schoolMembershipsWithPermissions(
        requiredPermissions: PermissionName[],
        operator: 'AND' | 'OR' = 'AND'
    ): Promise<string[]> {
        const schoolIds: string[] = []
        const schoolPermissions = await this.schoolPermissions(this.user_id)

        if (requiredPermissions.length === 0) {
            const schoolIdsFromPerms = Array.from(schoolPermissions.keys())
            return schoolIdsFromPerms
        }

        for (const [schoolId, permissions] of schoolPermissions) {
            let hasRequiredPerms = operator === 'AND' ? true : false
            for (const p of requiredPermissions) {
                if (operator === 'OR') {
                    hasRequiredPerms = hasRequiredPerms || permissions.has(p)
                } else {
                    hasRequiredPerms = hasRequiredPerms && permissions.has(p)
                }
            }
            if (hasRequiredPerms) {
                schoolIds.push(schoolId)
            }
        }

        return schoolIds
    }

    public async permissionsInOrganization(organizationId: string) {
        const orgPermissions = await this.organizationPermissions(this.user_id)
        const permissions = orgPermissions.get(organizationId)
        return permissions ? Array.from(permissions) : []
    }
    public async permissionsInSchool(schoolId: string) {
        const schoolPermissions = await this.schoolPermissions(this.user_id)
        const permissions = schoolPermissions.get(schoolId)
        return permissions ? Array.from(permissions) : []
    }
}
