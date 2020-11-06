import { 
    Column,
    PrimaryGeneratedColumn,
    Entity,
    OneToMany,
    getRepository,
    getManager,
    getConnection,
    JoinColumn,
    OneToOne,
    ManyToOne,
    BaseEntity,
} from 'typeorm';
import { GraphQLResolveInfo } from 'graphql';
import { ApolloError } from 'apollo-server-express'
import { OrganizationMembership } from './organizationMembership';
import { Role } from './role';
import { Permission } from './permission';
import { User } from './user';
import { Class } from './class';
import { School } from './school';
import { DefaultRoles, DefaultPermissions } from '../utils/defaultRolesPermissions'

@Entity()
export class Organization extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    public readonly organization_id!: string;
    
    @Column({nullable: true})
    public organization_name?: string
    
    @Column({nullable: true})
    public address1?: string
    
    @Column({nullable: true})
    public address2?: string
    
    @Column({nullable: true})
    public phone?: string
    
    @Column({nullable: true})
    public shortCode?: string

    @OneToMany(() => OrganizationMembership, membership => membership.organization)
    @JoinColumn({name: "user_id", referencedColumnName: "user_id"})
    public memberships?: Promise<OrganizationMembership[]>

    public async membership({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(OrganizationMembership).findOneOrFail({where: {user_id, organization_id: this.organization_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @OneToOne(() => User, user => user.my_organization)
    public owner?: Promise<User>

    @ManyToOne(() => User)
    @JoinColumn()
    public primary_contact?: Promise<User>
    
    @OneToMany(() => Role, role => role.organization)
    @JoinColumn()
    public roles?: Promise<Role[]>

    @OneToMany(() => School, school => school.organization)
    @JoinColumn()
    public schools?: Promise<School[]>

    @OneToMany(() => Class, class_ => class_.organization)
    @JoinColumn()
    public classes?: Promise<Class[]>

    public async membersWithPermission({permission_name, search_query}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const query = getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin("OrganizationMembership.user","User")
                .innerJoin("OrganizationMembership.roles","Role")
                .innerJoin("Role.permissions","Permission")
                .groupBy("OrganizationMembership.organization_id, Permission.permission_name, OrganizationMembership.user_id, User.user_name")
                .where("OrganizationMembership.organization_id = :organization_id", this)
                .andWhere("Permission.permission_name = :permission_name", {permission_name})
                .having("bool_and(Permission.allow) = :allowed", {allowed: true})
            
            if(search_query) {
                query
                    .addSelect("similarity(User.user_name, :user_name)", "similarity")
                    .andWhere("User.user_name % :user_name")
                    .orderBy("similarity", "DESC")
                    .setParameter("user_name", search_query)
            }
            
            const results = await query.getMany()
            return results
        } catch(e) {
            console.error(e)
        }
    }

    public async findMembers({search_query}: any, context: any, info: GraphQLResolveInfo) {
        try {
            return await getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin("OrganizationMembership.user", "User")
                .where("OrganizationMembership.organization_id = :organization_id", this)
                .andWhere("User.user_name % :user_name")
                .addSelect("similarity(User.user_name, :user_name)", "similarity")
                .orderBy("similarity", "DESC")
                .setParameter("user_name", search_query)
                .getMany();
        } catch(e) {
            console.error(e)
        }
    }

    public async setPrimaryContact({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            
            const user = await getRepository(User).findOneOrFail({user_id})
            this.primary_contact = Promise.resolve(user)
            await getManager().save(this)
            
            return user
        } catch(e) {
            console.error(e)
        }
    }

    public async addUser({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            const membership = new OrganizationMembership()
            membership.organization_id = this.organization_id
            membership.organization = Promise.resolve(this)
            membership.user_id = user_id
            membership.user = getRepository(User).findOneOrFail(user_id)

            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    public async createRole({role_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const manager = getManager()
            
            const role = new Role()
            role.role_name = role_name
            role.organization = Promise.resolve(this)
            await manager.save(role)
            return role
        } catch(e) {
            console.error(e)
        }
    }

    public async createClass({class_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const manager = getManager()
            
            const _class = new Class()
            _class.class_name = class_name
            _class.organization = Promise.resolve(this)
            await manager.save(_class)

            return _class
        } catch(e) {
            console.error(e)
        }
    }

    public async createSchool({school_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            
            const school = new School()
            school.school_name = school_name
            school.organization = Promise.resolve(this)
            await school.save()

            return school
        } catch(e) {
            console.error(e)
        }
    }

    public async setDefaultRolesPermissions({}: any, context: any, info: GraphQLResolveInfo) {
        const queryRunner = getConnection().createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()
        
        try {
            if(info.operation.operation !== "mutation") { return null }
            for(let i = 0; i < DefaultRoles.length; i++) {
                let role = await getRepository(Role).findOne({where: {role_name: DefaultRoles[i], organization: this}})
                if(!role) { 
                    role = new Role()
                    role.role_name = DefaultRoles[i]
                    role.organization = Promise.resolve(this)
                    await queryRunner.manager.save(role)
                }
                for(let j = 0; j < DefaultPermissions.length; j++ ) {
                    let permission = await getRepository(Permission).findOne({where: { permission_name: DefaultPermissions[j], role_id: role.role_id }})
                    if(!permission) { 
                        permission = new Permission()
                        permission.role_id = role.role_id
                        permission.permission_name = DefaultPermissions[j].name
                    }
                    permission.allow = DefaultPermissions[j].roles.includes(role.role_name as string)
                    await queryRunner.manager.save(permission)
                }
            }
            await queryRunner.commitTransaction()
            return this
        } catch(e) {
            await queryRunner.rollbackTransaction();
            console.error(e)
            throw new ApolloError(e)
        } finally {
            await queryRunner.release();
        }
    }
}
