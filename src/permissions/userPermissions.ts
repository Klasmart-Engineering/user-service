import { getRepository } from "typeorm";
import { OrganizationMembership } from "../entities/organizationMembership";
import { SchoolMembership } from "../entities/schoolMembership";
import { PermissionName } from './permissionNames';

interface PermissionContext {
    school_id?: string
    organization_id?: string
}

export class UserPermissions {
    private _organizationPermissions?: Promise<Map<string, Set<string>>>
    private _schoolPermissions?: Promise<Map<string, Set<string>>>

    private readonly user_id?: string
    public constructor(user_id?: string) {
        this.user_id = user_id
    }

    public async rejectIfNotAllowed({school_id, organization_id}: PermissionContext, permission_name: PermissionName) {
        const isAllowed = await this.allowed({school_id, organization_id}, permission_name)

        if(!isAllowed && organization_id) {
            throw new Error(`User(${this.user_id}) does not have Permission(${permission_name}) in Organization(${organization_id})`)
        }
        if(!isAllowed && school_id) {
            throw new Error(`User(${this.user_id}) does not have Permission(${permission_name}) in School(${school_id})`)
        }
    }

    public async allowed({school_id, organization_id}: PermissionContext, permission_name: PermissionName) {
        let output = false

        if(organization_id) {
            const allOrganizationPermisions = await this.organizationPermissions()
            const organizationPermissions = allOrganizationPermisions.get(organization_id)

            if(organizationPermissions && organizationPermissions.has(permission_name)) {
              output = true
            }
        }
        if(!output && school_id) {
            const allSchoolPermissions = await this.schoolPermissions()
            const schoolPermissions = allSchoolPermissions.get(school_id)

            if(schoolPermissions && schoolPermissions.has(permission_name)) {
              output = true
            }
        }

        return output
    }

    private async organizationPermissions(): Promise<Map<string, Set<string>>> {
        if(!this._organizationPermissions) {
            this._organizationPermissions = new Promise<Map<string, Set<string>>>(async (resolve,reject) => {
                try {
                    const organizationPermissions = new Map<string, Set<string>>()
                    if(!this.user_id) { resolve(organizationPermissions); return }
                    //TODO: Adjust for returning explicity denial
                    const organizationPermissionResults = await getRepository(OrganizationMembership)
                    .createQueryBuilder()
                    .innerJoin("OrganizationMembership.roles", "Role")
                    .innerJoin("Role.permissions", "Permission")
                    .select("OrganizationMembership.organization_id, Permission.permission_name")
                    .where("OrganizationMembership.user_id = :user_id", {user_id: this.user_id})
                    .groupBy("OrganizationMembership.user_id, OrganizationMembership.organization_id, Permission.permission_name")
                    .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                    .getRawMany()

                    for(const {organization_id, permission_name} of organizationPermissionResults) {
                        const permissions = organizationPermissions.get(organization_id)
                        if(permissions) {
                            permissions.add(permission_name)
                        } else {
                            organizationPermissions.set(organization_id, new Set([permission_name]))
                        }
                    }
                    resolve(organizationPermissions)
                } catch(e) {
                    reject(e)
                }
            })
        }
        return this._organizationPermissions
    }

    private async schoolPermissions(): Promise<Map<string, Set<string>>> {
        if(!this._schoolPermissions) {
            this._schoolPermissions = new Promise<Map<string, Set<string>>>(async (resolve,reject) => {
                try {
                    const schoolPermissions = new Map<string, Set<string>>()
                    if(!this.user_id) { resolve(schoolPermissions); return }
                    //TODO: Adjust for returning explicity denial
                    const schoolPermissionResults = await getRepository(SchoolMembership)
                    .createQueryBuilder()
                    .innerJoin("SchoolMembership.roles", "Role")
                    .innerJoin("Role.permissions", "Permission")
                    .select("SchoolMembership.school_id, Permission.permission_name")
                    .where("SchoolMembership.user_id = :user_id", {user_id: this.user_id})
                    .groupBy("SchoolMembership.user_id, SchoolMembership.school_id, Permission.permission_name")
                    .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                    .getRawMany()

                    for(const {school_id, permission_name} of schoolPermissionResults) {
                        const permissions = schoolPermissions.get(school_id)
                        if(permissions) {
                            permissions.add(permission_name)
                        } else {
                            schoolPermissions.set(school_id, new Set([permission_name]))
                        }
                    }
                    resolve(schoolPermissions)
                } catch(e) {
                    reject(e)
                }
            })
        }
        return this._schoolPermissions
    }

}
