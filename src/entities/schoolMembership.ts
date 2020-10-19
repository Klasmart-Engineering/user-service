import {Entity, ManyToOne, PrimaryColumn, CreateDateColumn, ManyToMany, BaseEntity, getRepository, createQueryBuilder} from "typeorm";
import { User } from "./user";
import { Role } from "./role";
import { GraphQLResolveInfo } from "graphql";
import { School } from "./school";
import { Class } from "./class";

@Entity()
export class SchoolMembership extends BaseEntity {
    @PrimaryColumn()
    public user_id!: string
    
    @PrimaryColumn()
    public school_id!: string
    
    @CreateDateColumn()
    public join_timestamp?: Date
    
    @ManyToOne(() => User, user => user.memberships)
    public user?: Promise<User>
    
    @ManyToOne(() => School, organization => organization.memberships)
    public school?: Promise<School>

    @ManyToMany(() => Role, role => role.memberships)
    public roles?: Promise<Role[]>

    public async checkAllowed({ permission_name }: any, context: any, info: GraphQLResolveInfo) {
        const results = await createQueryBuilder("SchoolMembership")
        .innerJoinAndSelect("SchoolMembership.roles", "Role")
        .innerJoinAndSelect("Role.permissions", "Permission")
        .where("SchoolMembership.user_id = :user_id", this)
        .andWhere("SchoolMembership.organization_id = :organization_id", this)
        .andWhere("Permission.permission_name = :permission_name", { permission_name })
        .getRawMany()
        if(results.length === 0) { return false }
        return results.every((v) => v.Permission_allow)
    }

    public async addRole({ role_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const newRole = await getRepository(Role).findOneOrFail({role_id})
            const roles = (await this.roles) || []
            roles.push(newRole)
            this.roles = Promise.resolve(roles)
            await this.save()
            return newRole
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