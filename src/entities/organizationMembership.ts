import { Entity, ManyToOne, PrimaryColumn, CreateDateColumn, ManyToMany, BaseEntity, getRepository, createQueryBuilder, getManager } from "typeorm";
import { User } from "./user";
import { Organization } from "./organization";
import { Role } from "./role";
import { GraphQLResolveInfo } from "graphql";
import { Context } from "../main";
import { SchoolMembership } from "./schoolMembership";

@Entity()
export class OrganizationMembership extends BaseEntity {
    @PrimaryColumn()
    public user_id!: string

    @PrimaryColumn()
    public organization_id!: string

    @CreateDateColumn()
    public join_timestamp?: Date

    @ManyToOne(() => User, user => user.memberships)
    public user?: Promise<User>

    @ManyToOne(() => Organization, organization => organization.memberships)
    public organization?: Promise<Organization>

    @ManyToMany(() => Role, role => role.memberships)
    public roles?: Promise<Role[]>

    public async schoolMemberships({ permission_name }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            if (permission_name === undefined) {

                return await getRepository(SchoolMembership)
                    .createQueryBuilder()
                    .innerJoin("SchoolMembership.school", "School")
                    .innerJoin("School.organization", "SchoolOrganization")
                    .where("SchoolMembership.user_id = :user_id", { user_id: this.user_id })
                    .andWhere("SchoolOrganization.organization_id = :organization_id", { organization_id: this.organization_id })
                    .getMany()

            }
            else {

                return await getRepository(SchoolMembership)
                    .createQueryBuilder()
                    .innerJoin("SchoolMembership.school", "School")
                    .innerJoin("School.organization", "SchoolOrganization")
                    .innerJoin("SchoolMembership.roles", "Role")
                    .innerJoin("Role.permissions", "Permission")
                    .groupBy("SchoolMembership.school_id, Permission.permission_name, SchoolMembership.user_id")
                    .where("SchoolMembership.user_id = :user_id", { user_id: this.user_id })
                    .andWhere("SchoolOrganization.organization_id = :organization_id", { organization_id: this.organization_id })
                    .andWhere("Permission.permission_name = :permission_name", { permission_name })
                    .having("bool_and(Permission.allow) = :allowed", { allowed: true })
                    .getMany()

            }
        } catch (e) {
            console.error(e)
        }
    }

    public async checkAllowed({ permission_name }: any, context: any, info: GraphQLResolveInfo) {
        const results = await createQueryBuilder("OrganizationMembership")
            .innerJoinAndSelect("OrganizationMembership.roles", "Role")
            .innerJoinAndSelect("Role.permissions", "Permission")
            .where("OrganizationMembership.user_id = :user_id", { user_id: this.user_id })
            .andWhere("OrganizationMembership.organization_id = :organization_id", { organization_id: this.organization_id })
            .andWhere("Permission.permission_name = :permission_name", { permission_name })
            .getRawMany()
        if (results.length === 0) { return false }
        return results.every((v) => v.Permission_allow)
    }

    public async addRole({ role_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if (info.operation.operation !== "mutation") { return null }
            const role = await getRepository(Role).findOneOrFail({ role_id })
            const memberships = (await role.memberships) || []
            memberships.push(this)
            role.memberships = Promise.resolve(memberships)
            await role.save()
            return role
        } catch (e) {
            console.error(e)
        }
    }

    public async addRoles({ role_ids }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if (info.operation.operation !== "mutation") { return null }
            if (!(role_ids instanceof Array)) { return null }

            const rolePromises = role_ids.map(async (role_id) => {
                const role = await getRepository(Role).findOneOrFail({ role_id })
                const memberships = (await role.memberships) || []
                memberships.push(this)
                role.memberships = Promise.resolve(memberships)
                return role
            })
            const roles = await Promise.all(rolePromises)
            await getManager().save(roles)
            return roles
        } catch (e) {
            console.error(e)
        }
    }

    public async removeRole({ role_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if (info.operation.operation !== "mutation") { return null }

            const role = await getRepository(Role).findOneOrFail({ role_id })
            const memberships = await role.memberships
            if (memberships) {
                const newMemberships = memberships.filter((membership) => membership.user_id !== this.user_id)
                role.memberships = Promise.resolve(newMemberships)
                await role.save()
            }
            return this
        } catch (e) {
            console.error(e)
        }
    }
    public async leave({ }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if (info.operation.operation !== "mutation") { return null }
            await this.remove()
            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

}