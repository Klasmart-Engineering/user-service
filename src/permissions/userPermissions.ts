import { getRepository } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { User } from '../entities/user'
import { SchoolMembership } from '../entities/schoolMembership'
import { Status } from '../entities/status'
import { PermissionName } from './permissionNames'
import { superAdminRole } from './superAdmin'
import { uniqueAndTruthy } from '../utils/clean'
import { Organization } from '../entities/organization'
import { TokenPayload } from '../token'

export interface PermissionContext {
    school_ids?: string[]
    organization_ids?: string[]
    user_id?: string
}

type PermissionCheckOutput = {
    passed: boolean
    userId?: string
    unauthorisedOrgIds?: string[]
    unauthorisedSchoolIds?: string[]
    isInactive?: boolean
}

export class UserPermissions {
    static ADMIN_EMAILS = [
        'sandy@calmid.com',
        'pj.williams@calmid.com',
        'owen.delahoy@calmid.com',
        'toghrul.taghiyev@kidsloop.live',
        'emfg@calmid.com',
    ]

    private _organizationPermissions?: Promise<Map<string, Set<string>>>
    private _schoolPermissions?: Promise<Map<string, Set<string>>>

    private readonly user_id?: string
    private readonly email?: string
    private readonly phone?: string
    private readonly username?: string
    private user?: User
    public readonly isAdmin: boolean = false
    private _userResolver?: Promise<User | undefined>

    // Used to mark that auth was done by API Key, but checks use isAdmin
    // for consistency
    public readonly authViaAPIKey: boolean = false

    public constructor(
        token?: Pick<TokenPayload, 'id' | 'user_name' | 'email' | 'phone'>,
        apiKeyAuth = false
    ) {
        this.user_id = token?.id

        if (token?.email && token?.email.length > 0) {
            this.email = token?.email
        }

        if (token?.phone && token?.phone.length > 0) {
            this.phone = token?.phone
        }

        this.authViaAPIKey = apiKeyAuth

        if (this.authViaAPIKey || this.isAdminEmail(this.email!)) {
            this.isAdmin = true
        }
        if (
            typeof token?.user_name == 'string' &&
            token?.user_name?.length > 0
        ) {
            this.username = token?.user_name
        }
    }

    private isAdminEmail(email: string): boolean {
        return UserPermissions.ADMIN_EMAILS.includes(email)
    }

    public getUserId(): string | undefined {
        return this.user_id
    }

    private getUserIdOrError(uid = this.user_id): string {
        if (!uid) throw new Error(`User is required for authorization`)
        return uid
    }

    private async getUser(uid = this.user_id): Promise<User> {
        if (this.user && this.user?.user_id === uid) return this.user

        if (!this._userResolver) {
            this._userResolver = getRepository(User).findOne(
                this.getUserIdOrError(uid)
            )
        }
        this.user = await this._userResolver
        if (!this.user) throw new Error(`User(${uid}) not found`)
        return this.user
    }

    public getEmail(): string | undefined {
        return this.email
    }

    public getPhone(): string | undefined {
        return this.phone
    }

    public getUsername(): string | undefined {
        return this.username
    }

    public rejectIfNotAdmin(): void {
        if (!this.isAdmin) {
            throw new Error(
                `User(${this.user_id}) does not have Admin permissions`
            )
        }
    }

    public rejectIfNotAuthenticated(): void {
        if (!this.user_id) {
            throw new Error(
                `User not authenticated. Please authenticate to proceed`
            )
        }
    }

    private hasAdminAccess(permission_name: PermissionName): boolean {
        if (superAdminRole.permissions.includes(permission_name)) {
            if (this.authViaAPIKey || this.isAdmin) {
                return true
            }
        }
        return false
    }

    private isUserActive(user: User | undefined) {
        return user?.status === Status.ACTIVE
    }

    public async rejectIfNotAllowed(
        permission_context: PermissionContext,
        permission_name: PermissionName
    ): Promise<void> {
        const permOutput: PermissionCheckOutput = await this.hasPermissions(
            permission_context,
            permission_name
        )
        if (permOutput.passed) return
        if (permOutput.isInactive) {
            throw new Error(
                `User(${permOutput.userId}) has been deleted, so does not have Permission(${permission_name})`
            )
        }

        let message = `User(${permOutput.userId}) does not have Permission(${permission_name})`
        if (permOutput.unauthorisedOrgIds?.length)
            message += ` in Organizations(${permOutput.unauthorisedOrgIds})`
        if (permOutput.unauthorisedSchoolIds?.length)
            message += ` in Schools(${permOutput.unauthorisedSchoolIds})`
        throw new Error(message)
    }

    public async allowed(
        permission_context: PermissionContext,
        permission_name: PermissionName
    ): Promise<boolean> {
        return (await this.hasPermissions(permission_context, permission_name))
            .passed
    }

    private async hasPermissions(
        permission_context: PermissionContext,
        permission_name: PermissionName
    ): Promise<PermissionCheckOutput> {
        if (this.authViaAPIKey) {
            if (this.hasAdminAccess(permission_name)) {
                return { passed: true }
            } else {
                return { passed: false }
            }
        }
        // Clean & fetch data
        const cpc = cleanPermissionContext(permission_context)
        const userId = cpc.user_id
        const orgIds = cpc.organization_ids
        let schoolIds = cpc.school_ids
        const user = await this.getUser(userId)
        // Perform initial checks
        if (!this.isUserActive(user)) {
            return { passed: false, userId: user.user_id, isInactive: true }
        }
        if (this.hasAdminAccess(permission_name)) return { passed: true }
        if (!orgIds?.length && !schoolIds?.length)
            return { passed: false, userId: user.user_id }

        let unauthorisedOrgIds: string[] = []
        let unauthorisedSchoolIds: string[] = []
        let schoolOrgMap = new Map<string, string>()
        let orgSchoolsMap = new Map<string, string[]>()

        if (orgIds?.length && schoolIds?.length) {
            ;[orgSchoolsMap, schoolOrgMap] = await getSchoolOrgRelations(
                orgIds,
                schoolIds
            )
        }

        if (orgIds?.length) {
            // Get organizationIds which have the permission
            const authorisedOrgIds = await this.organizationsWithPermission(
                user.user_id,
                permission_name,
                orgIds
            )
            unauthorisedOrgIds = orgIds.filter(
                (mp) => !authorisedOrgIds.includes(mp)
            )
            // Remove schools if their organization already has the permission
            if (authorisedOrgIds?.length) {
                schoolIds = schoolIds?.filter((sid) => {
                    const orgId = schoolOrgMap.get(sid)
                    if (!orgId) return true
                    return !authorisedOrgIds.includes(orgId)
                })
            }
        }

        if (schoolIds?.length) {
            // Get schoolIds which have the permission
            const authorisedSchoolIds = await this.schoolsWithPermission(
                user.user_id,
                permission_name,
                schoolIds
            )
            unauthorisedSchoolIds = schoolIds.filter(
                (ms) => !authorisedSchoolIds.includes(ms)
            )
            // Remove organizations if their school has the permission
            if (authorisedSchoolIds?.length && unauthorisedOrgIds?.length) {
                unauthorisedOrgIds = unauthorisedOrgIds.filter((uoid) => {
                    const schoolIdsToCheck = orgSchoolsMap.get(uoid)
                    return !schoolIdsToCheck?.every((sidtc) =>
                        authorisedSchoolIds.includes(sidtc)
                    )
                })
            }
        }

        // Pass if all schools and orgs  are authorized, fail otherwise
        if (!unauthorisedSchoolIds.length && !unauthorisedOrgIds.length) {
            return { passed: true }
        }

        return {
            passed: false,
            userId: user.user_id,
            unauthorisedOrgIds,
            unauthorisedSchoolIds,
        }
    }

    private async organizationsWithPermission(
        userId: string,
        permissionName: string,
        organizationIds: string[]
    ): Promise<string[]> {
        const orgsWithPermission: string[] = []
        const allOrganizationPermisions = await this.organizationPermissions(
            userId
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

    private async schoolsWithPermission(
        userId: string,
        permissionName: string,
        schoolIds: string[]
    ): Promise<string[]> {
        const schoolsWithPermission: string[] = []
        const allSchoolPermissions = await this.schoolPermissions(userId)
        for (const schoolId of schoolIds) {
            const schoolPermissions = allSchoolPermissions.get(schoolId)
            if (schoolPermissions && schoolPermissions.has(permissionName)) {
                schoolsWithPermission.push(schoolId)
            }
        }
        return schoolsWithPermission
    }

    private async organizationPermissions(
        userId: string
    ): Promise<Map<string, Set<string>>> {
        if (!this._organizationPermissions) {
            const organizationPermissions = new Map<string, Set<string>>()
            if (!userId) {
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
                    user_id: userId,
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
        userId: string
    ): Promise<Map<string, Set<string>>> {
        if (!this._schoolPermissions) {
            const schoolPermissions = new Map<string, Set<string>>()
            if (!userId) {
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
                    user_id: userId,
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
        const userId = this.getUserIdOrError()
        const orgPermissions = await this.organizationPermissions(userId)

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
        const userId = this.getUserIdOrError()
        const schoolPermissions = await this.schoolPermissions(userId)

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
        const orgPermissions = await this.organizationPermissions(
            this.getUserIdOrError()
        )
        const permissions = orgPermissions.get(organizationId)
        return permissions ? Array.from(permissions) : []
    }
    public async permissionsInSchool(schoolId: string) {
        const schoolPermissions = await this.schoolPermissions(
            this.getUserIdOrError()
        )
        const permissions = schoolPermissions.get(schoolId)
        return permissions ? Array.from(permissions) : []
    }

    // this needs to be removed
    public async organizationsWhereItIsAllowed(
        organizationIds: string[],
        permissionName: string
    ): Promise<string[]> {
        const user = await this.getUser()
        const isActive = user.status === Status.ACTIVE
        if (!isActive) return []

        const orgsWithPermission: string[] = []
        const allOrganizationPermisions = await this.organizationPermissions(
            user.user_id
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
}

function cleanPermissionContext(pc: PermissionContext): PermissionContext {
    return {
        school_ids: uniqueAndTruthy(pc.school_ids),
        organization_ids: uniqueAndTruthy(pc.organization_ids),
        user_id: pc.user_id ? pc.user_id : undefined,
    }
}

async function getSchoolOrgRelations(
    organizationIds: string[],
    schoolIds: string[]
): Promise<[Map<string, string[]>, Map<string, string>]> {
    const results = await getRepository(Organization)
        .createQueryBuilder('Organization')
        .select([`Organization.organization_id, School.school_id`])
        .leftJoin('Organization.schools', 'School')
        .where(
            'Organization.organization_id IN (:...organizationIds) AND School.school_id IN (:...schoolIds)',
            { organizationIds, schoolIds }
        )
        .getRawMany()
    const orgSchoolsMap = new Map<string, string[]>()
    for (const relation of results) {
        const mapEntry = orgSchoolsMap.get(relation.organization_id)
        if (mapEntry) mapEntry.push(relation.school_id)
        else orgSchoolsMap.set(relation.organization_id, [relation.school_id])
    }
    const schoolOrgMap = new Map<string, string>(
        results.map((r) => [r.school_id, r.organization_id])
    )
    return [orgSchoolsMap, schoolOrgMap]
}
