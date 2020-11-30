import {Entity, ManyToOne, PrimaryColumn, CreateDateColumn, ManyToMany, BaseEntity, getRepository, createQueryBuilder, getManager} from "typeorm";
import { UserProfile } from "./userprofile";
import { Organization } from "./organization";
import { Role } from "./role";
import { GraphQLResolveInfo } from "graphql";

@Entity()
export class OrganizationMembershipNew extends BaseEntity {
    @PrimaryColumn()
    public user_profile_id!: string
    
    @PrimaryColumn()
    public organization_id!: string
    
    @CreateDateColumn()
    public join_timestamp?: Date
    
    @ManyToOne(() => UserProfile, userprofile => userprofile.memberships)
    public user_profile?: Promise<UserProfile>

    @ManyToOne(() => Organization, organization => organization.memberships)
    public organization?: Promise<Organization>

    @ManyToMany(() => Role, role => role.memberships,)
    public roles?: Promise<Role[]>

    public async checkAllowed({ permission_name }: any, context: any, info: GraphQLResolveInfo) {
        const results = await createQueryBuilder("OrganizationMembership")
        .innerJoinAndSelect("OrganizationMembership.roles", "Role")
        .innerJoinAndSelect("Role.permissions", "Permission")
        .where("OrganizationMembershipNew.user_profile_id = :user_profile_id", this)
        .andWhere("OrganizationMembershipNew.organization_id = :organization_id", this)
        .andWhere("Permission.permission_name = :permission_name", { permission_name })
        .getRawMany()
        if(results.length === 0) { return false }
        return results.every((v) => v.Permission_allow)
    }

    public async addRole({ role_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const role = await getRepository(Role).findOneOrFail({role_id})
            const memberships = (await role.memberships) || []
            memberships.push(this)
            role.memberships = Promise.resolve(memberships)
            await role.save()
            return role
        } catch(e) {
            console.error(e)
        }
    }

    public async addRoles({ role_ids }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            if(!(role_ids instanceof Array)) { return null }
            
            const rolePromises = role_ids.map(async (role_id) => {
                const role = await getRepository(Role).findOneOrFail({role_id})
                const memberships = (await role.memberships) || []
                memberships.push(this)
                role.memberships = Promise.resolve(memberships)
                return role
            })
            const roles = await Promise.all(rolePromises)
            await getManager().save(roles)
            return roles
        } catch(e) {
            console.error(e)
        }
    }

    public async removeRole({ role_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            
            const role = await getRepository(Role).findOneOrFail({role_id})
            const memberships = await role.memberships
            if(memberships) {   
                const newMemberships = memberships.filter((membership) => membership.user_id !== this.user_id)
                role.memberships = Promise.resolve(newMemberships)
                await role.save()
            }
            return this
        } catch(e) {
            console.error(e)
        }
    }
    public async leave({}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            await this.remove()
            return true
        } catch(e) {
            console.error(e)
        }
        return false
    }

}