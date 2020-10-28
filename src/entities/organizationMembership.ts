import {Entity, ManyToOne, PrimaryColumn, CreateDateColumn, ManyToMany, BaseEntity, getRepository, createQueryBuilder} from "typeorm";
import { User } from "./user";
import { Organization } from "./organization";
import { Role } from "./role";
import { GraphQLResolveInfo } from "graphql";

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

    @ManyToMany(() => Role, role => role.memberships,)
    public roles?: Promise<Role[]>

    public async checkAllowed({ permission_name }: any, context: any, info: GraphQLResolveInfo) {
        const results = await createQueryBuilder("OrganizationMembership")
        .innerJoinAndSelect("OrganizationMembership.roles", "Role")
        .innerJoinAndSelect("Role.permissions", "Permission")
        .where("OrganizationMembership.user_id = :user_id", this)
        .andWhere("OrganizationMembership.organization_id = :organization_id", this)
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