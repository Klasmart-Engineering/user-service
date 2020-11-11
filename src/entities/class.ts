import { GraphQLResolveInfo } from "graphql";
import { BaseEntity, Column, Entity, getRepository, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Organization } from "./organization";
import { School } from "./school";
import { User } from "./user";
import { Context } from '../main';
import { PermissionName } from '../permissions/permissionNames';

@Entity()
export class Class extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    public class_id!: string

    @Column()
    public class_name?: String

    @ManyToOne(() => Organization, organization => organization.classes)
    public organization?: Promise<Organization>

    @ManyToMany(() => School, school => school.classes)
    public schools?: Promise<School[]>

    @ManyToMany(() => User, user => user.classesTeaching)
    public teachers?: Promise<User[]>

    @ManyToMany(() => User, user => user.classesStudying)
    public students?: Promise<User[]>

    public async set({class_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_class_20334
            )
            
            if(typeof class_name === "string") { this.class_name = class_name }
            
            await this.save()

            return this
        } catch(e) {
            console.error(e)
        }
    } 

    public async addTeacher({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.add_teachers_to_class_20226
            )
            const user = await getRepository(User).findOneOrFail({user_id})
            const classes  = (await user.classesTeaching) || []
            classes.push(this)
            user.classesTeaching = Promise.resolve(classes)
            await user.save()

            return user
        } catch(e) {
            console.error(e)
        }
    }

    public async addStudent({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.add_students_to_class_20225
            )
            const user = await getRepository(User).findOneOrFail({user_id})
            const classes  = (await user.classesStudying) || []
            classes.push(this)
            user.classesStudying = Promise.resolve(classes)
            await user.save()

            return user
        } catch(e) {
            console.error(e)
        }
    }

    public async addSchool({school_id}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_school_20330
            )
            const school = await getRepository(School).findOneOrFail({school_id})
            const classes  = (await school.classes) || []
            classes.push(this)
            school.classes = Promise.resolve(classes)
            await school.save()

            return school
        } catch(e) {
            console.error(e)
        }
    }

    public async delete({}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.delete_class_20444
            )
            await this.remove()
            return true
        } catch(e) {
            console.error(e)
        }
        return false
    }

}