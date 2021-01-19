import { getRepository } from 'typeorm'
import { OrganizationMembership } from '../entities/organizationMembership'
import { SchoolMembership } from '../entities/schoolMembership'
import { PermissionName } from './permissionNames'
import { superAdminRole } from './superAdmin'

interface PermissionContext {
    school_ids?: string[]
    organization_id?: string
}

export class UserPermissions {
    private _organizationPermissions?: Promise<Map<string, Set<string>>>
    private _schoolPermissions?: Promise<Map<string, Set<string>>>

    private readonly user_id?: string
    public readonly isAdmin?: boolean

    public constructor(token?: any) {
        this.user_id = token?.id
        this.isAdmin = !!token?.admin
    }

    public async rejectIfNotAllowed(
        { school_ids, organization_id }: PermissionContext,
        permission_name: PermissionName
    ) {
        const isAllowed = await this.allowed(
            { school_ids, organization_id },
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
        { school_ids, organization_id }: PermissionContext,
        permission_name: PermissionName
    ) {
        let output =
            this.isAdmin && superAdminRole.permissions.includes(permission_name)

        if (!output && organization_id) {
            const allOrganizationPermisions = await this.organizationPermissions()
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
            const allSchoolPermissions = await this.schoolPermissions()
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

    private async organizationPermissions(): Promise<Map<string, Set<string>>> {
        if (!this._organizationPermissions) {
            this._organizationPermissions = new Promise<
                Map<string, Set<string>>
            >(async (resolve, reject) => {
                try {
                    const organizationPermissions = new Map<
                        string,
                        Set<string>
                    >()
                    if (!this.user_id) {
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
                            user_id: this.user_id,
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

    private async schoolPermissions(): Promise<Map<string, Set<string>>> {
        if (!this._schoolPermissions) {
            this._schoolPermissions = new Promise<Map<string, Set<string>>>(
                async (resolve, reject) => {
                    try {
                        const schoolPermissions = new Map<string, Set<string>>()
                        if (!this.user_id) {
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
                                user_id: this.user_id,
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
}
