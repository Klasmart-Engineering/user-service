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
    ]

    private _organizationPermissions?: Promise<Map<string, Set<string>>>
    private _schoolPermissions?: Promise<Map<string, Set<string>>>

    private readonly user_id?: string
    private readonly email: string
    public readonly isAdmin?: boolean

    public constructor(token?: any) {
        this.user_id = token?.id
        this.email = token?.email || ''
        this.isAdmin = this.isAdminEmail(this.email)
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

    private async isUserAdmin(user_id?: string) {
        const user = await User.findOne({ user_id })

        return this.isAdminEmail(user?.email || '')
    }

    public rejectIfNotAdmin() {
        if (!this.isAdminEmail(this.email)) {
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

    public async rejectIfNotAllowed(
        { school_ids, organization_id }: PermissionContext,
        permission_name: PermissionName
    ) {
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
        const isAdmin = await this.isUserAdmin(user_id)
        let output =
            isAdmin && superAdminRole.permissions.includes(permission_name)

        if (!output && organization_id) {
            const allOrganizationPermisions = await this.organizationPermissions(
                user_id
            )
            const organizationPermissions = allOrganizationPermisions.get(
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

    private async organizationPermissions(
        user_id?: string
    ): Promise<Map<string, Set<string>>> {
        if (!this._organizationPermissions) {
            this._organizationPermissions = new Promise<
                Map<string, Set<string>>
            >(async (resolve, reject) => {
                try {
                    const organizationPermissions = new Map<
                        string,
                        Set<string>
                    >()
                    if (!user_id) {
                        resolve(organizationPermissions)
                        return
                    }
                    //TODO: Adjust for returning explicity denial
                    const organizationPermissionResults = await getRepository(
                        OrganizationMembership
                    )
                        .createQueryBuilder()
                        .innerJoin('OrganizationMembership.roles', 'Role')
                        .innerJoin('Role.permissions', 'Permission')
                        .select(
                            'OrganizationMembership.organization_id, Permission.permission_name'
                        )
                        .where('OrganizationMembership.user_id = :user_id', {
                            user_id,
                        })
                        .andWhere('Role.status = :status', {
                            status: Status.ACTIVE,
                        })
                        .groupBy(
                            'OrganizationMembership.user_id, OrganizationMembership.organization_id, Permission.permission_name'
                        )
                        .having('bool_and(Permission.allow) = :allowed', {
                            allowed: true,
                        })
                        .getRawMany()

                    for (const {
                        organization_id,
                        permission_id,
                    } of organizationPermissionResults) {
                        const permissions = organizationPermissions.get(
                            organization_id
                        )
                        if (permissions) {
                            permissions.add(permission_id)
                        } else {
                            organizationPermissions.set(
                                organization_id,
                                new Set([permission_id])
                            )
                        }
                    }
                    resolve(organizationPermissions)
                } catch (e) {
                    reject(e)
                }
            })
        }
        return this._organizationPermissions
    }

    private async schoolPermissions(
        user_id?: string
    ): Promise<Map<string, Set<string>>> {
        if (!this._schoolPermissions) {
            this._schoolPermissions = new Promise<Map<string, Set<string>>>(
                async (resolve, reject) => {
                    try {
                        const schoolPermissions = new Map<string, Set<string>>()
                        if (!user_id) {
                            resolve(schoolPermissions)
                            return
                        }
                        //TODO: Adjust for returning explicity denial
                        const schoolPermissionResults = await getRepository(
                            SchoolMembership
                        )
                            .createQueryBuilder()
                            .innerJoin('SchoolMembership.roles', 'Role')
                            .innerJoin('Role.permissions', 'Permission')
                            .select(
                                'SchoolMembership.school_id, Permission.permission_name'
                            )
                            .where('SchoolMembership.user_id = :user_id', {
                                user_id,
                            })
                            .andWhere('Role.status = :status', {
                                status: Status.ACTIVE,
                            })
                            .groupBy(
                                'SchoolMembership.user_id, SchoolMembership.school_id, Permission.permission_name'
                            )
                            .having('bool_and(Permission.allow) = :allowed', {
                                allowed: true,
                            })
                            .getRawMany()

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
                        resolve(schoolPermissions)
                    } catch (e) {
                        reject(e)
                    }
                }
            )
        }
        return this._schoolPermissions
    }

    public async orgMembershipsWithPermissions(
        requiredPermissions: PermissionName[],
        operator: 'AND' | 'OR' = 'AND'
    ): Promise<string[]> {
        if (requiredPermissions.length === 0) {
            return []
        }
        const orgIds: string[] = []
        const orgPermissions = await this.organizationPermissions(this.user_id)

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

    public async schoolMembershipsWithPermissions(
        requiredPermissions: PermissionName[],
        operator: 'AND' | 'OR' = 'AND'
    ): Promise<string[]> {
        if (requiredPermissions.length === 0) {
            return []
        }

        const schoolIds: string[] = []
        const schoolPermissions = await this.schoolPermissions(this.user_id)

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
}
