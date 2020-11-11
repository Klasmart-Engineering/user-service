import {
    Column,
    PrimaryGeneratedColumn,
    Entity,
    OneToMany,
    getRepository,
    getManager,
    JoinColumn,
    OneToOne,
    ManyToOne,
    BaseEntity,
    EntityManager,
} from 'typeorm';
import { GraphQLResolveInfo } from 'graphql';
import { OrganizationMembership } from './organizationMembership';
import { Role } from './role';
import { User, accountUUID } from './user';
import { Class } from './class';
import { School } from './school';
import { organizationAdminRole } from '../permissions/organizationAdmin';
import { schoolAdminRole } from '../permissions/schoolAdmin';
import { parentRole } from '../permissions/parent';
import { studentRole } from '../permissions/student';
import { teacherRole } from '../permissions/teacher';
import { Permission } from './permission';
import { Context } from '../main';
import { PermissionName } from '../permissions/permissionNames';

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

    public async membership({user_id}: any, context: Context, info: GraphQLResolveInfo) {
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

    public async set({
        organization_name,
        address1,
        address2,
        phone,
        shortCode,
    }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = { organization_id: this.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_an_organization_details_5
            )

            if(info.operation.operation !== "mutation") { return null }

            if(typeof organization_name === "string") { this.organization_name = organization_name }
            if(typeof address1 === "string") { this.address1 = address1 }
            if(typeof address2 === "string") { this.address2 = address2 }
            if(typeof phone === "string") { this.phone = phone }
            if(typeof shortCode === "string") { this.shortCode = shortCode }

            await this.save()

            return this
        } catch(e) {
            console.error(e)
        }
    }

    public async membersWithPermission({permission_name, search_query}: any, context: Context, info: GraphQLResolveInfo) {
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

    public async findMembers({search_query}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = { organization_id: this.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.view_users_40110
            )

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

    public async setPrimaryContact({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = { organization_id: this.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_an_organization_details_5
            )

            if(info.operation.operation !== "mutation") { return null }

            const user = await getRepository(User).findOneOrFail({user_id})
            this.primary_contact = Promise.resolve(user)
            await getManager().save(this)

            return user
        } catch(e) {
            console.error(e)
        }
    }

    public async addUser({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = { organization_id: this.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.send_invitation_40882
            )

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

    public async inviteUser({email, given_name, family_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            const user_id = accountUUID(email)
            const newUser = await getRepository(User).findOne({email}) || new User()
            newUser.email = email
            newUser.user_id = user_id
            newUser.given_name = given_name
            newUser.family_name = family_name

            const organization_id = this.organization_id
            const membership = await getRepository(OrganizationMembership).findOne({organization_id, user_id}) || new OrganizationMembership()
            membership.organization_id = this.organization_id
            membership.user_id = newUser.user_id
            membership.organization = Promise.resolve(this)
            membership.user = Promise.resolve(newUser)

            await getManager().save([newUser, membership])
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    public async createRole({role_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = { organization_id: this.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.create_role_with_permissions_30222
            )

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

    public async createClass({class_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = { organization_id: this.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.create_class_20224
            )

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

    public async createSchool({school_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = { organization_id: this.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.create_school_20220
            )

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

    public async createDefaultRoles({}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            const roles = await this._createDefaultRoles()
            return [...roles.values()].flat()
        } catch(e) {
            console.error(e)
        }
    }

    public async _createDefaultRoles(manager: EntityManager = getManager()) {
        const roles = new Map<string, Role[]>()

        for(const {role_name, permissions} of [
            organizationAdminRole,
            schoolAdminRole,
            parentRole,
            studentRole,
            teacherRole,
        ]) {
            const role = new Role()

            const key = role.role_name||""
            const value = roles.get(key)
            if(value) { value.push(role) } else { roles.set(key, [role])  }

            role.role_name = role_name
            role.organization = Promise.resolve(this)
            await manager.save(role)
            const permissionEntities = [] as Permission[]
            for(const permission_name of permissions) {
                const permission = new Permission()
                permission.permission_name = permission_name
                permission.allow = true
                permission.role = Promise.resolve(role)
                permissionEntities.push(permission)
            }
            await manager.save(permissionEntities)
        }

        return roles
    }
}
