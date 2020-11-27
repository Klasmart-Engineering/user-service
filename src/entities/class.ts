import { 
    BaseEntity, 
    Column, 
    Entity, 
    getRepository, 
    ManyToMany, 
    ManyToOne, 
    PrimaryGeneratedColumn, 
    CreateDateColumn
} from "typeorm";
import { GraphQLResolveInfo } from "graphql";
import { Length, IsHexColor, IsOptional, IsDateString, Matches, validate } from 'class-validator'
import { Organization } from "./organization";
import { School } from "./school";
import { User } from "./user";
import { Context } from "../main";
import { PermissionName } from "../permissions/permissionNames";
import { ErrorHelpers, BasicValidationError } from '../entities/helpers'

export interface ClassInput {
    class_name: string,
    grades: string[],
    startDate: Date,
    endDate: Date,
    color: string,
}

@Entity()
export class Class extends BaseEntity {
    private _errors: null | undefined | BasicValidationError[]

    @PrimaryGeneratedColumn("uuid")
    public class_id!: string

    @Column({nullable: true})
    @Length(1, 35)
    public class_name?: String

    @Column("varchar",{ nullable: true, array: true})
    @IsOptional()
    public grades?: string[]

    @Column({nullable: true})
    @IsOptional()
    @IsDateString()
    public startDate?: Date

    @Column({nullable: true})
    @IsOptional()
    @IsDateString()
    public endDate?: Date

    @Column({nullable: true})
    @IsOptional()
    @IsHexColor()
    public color?: string

    @CreateDateColumn()
    public createdAt?: Date

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt?: Date

    public async status() {
        const now = new Date()
        if(this.startDate && this.endDate && now > this.endDate) {
            return "Inactive"
        }
        return "Active"
    }

    public async errors() {
        if(undefined !== this._errors) { return this._errors }
        
        this._errors = null
        const errs = await validate(this)
        if(errs.length > 0) {
            this._errors = ErrorHelpers.GetValidationError(errs)
        }
        return this._errors
    }

    public async isValid() {
        await this.errors()
        return (this._errors === null)
    }

    @ManyToOne(() => Organization, organization => organization.classes)
    public organization?: Promise<Organization>

    @ManyToMany(() => School, school => school.classes)
    public schools?: Promise<School[]>

    @ManyToMany(() => User, user => user.classesTeaching)
    public teachers?: Promise<User[]>

    @ManyToMany(() => User, user => user.classesStudying)
    public students?: Promise<User[]>

    public async set({
        class_name,
        grades,
        startDate,
        endDate,
        color
    }: ClassInput, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_class_20334
            )
            
            if(typeof class_name === "string")  { this.class_name = class_name }
            if(startDate instanceof Date)       { this.startDate = startDate }
            if(endDate instanceof Date)         { this.endDate = endDate }
            if(Array.isArray(grades))           { this.grades = grades }
            if(typeof color === "string")       { this.color = color }

            if(!await this.isValid()) {
                return this
            }

            await this.save()

            return this
        } catch(e) {
            console.error(e)
        }
    }
    
    public async eligibleTeachers({}: any, context: Context, info: GraphQLResolveInfo) {
        return this._membersWithPermission(PermissionName.attend_live_class_as_a_teacher_186)
    }
    
    public  async eligibleStudents({}: any, context: Context, info: GraphQLResolveInfo) {
        return this._membersWithPermission(PermissionName.attend_live_class_as_a_student_187)
    }
    
    public async _membersWithPermission(permission_name: PermissionName) {
        const results = new Map<string, User>()
        const userRepo = getRepository(User)
        const organizationPromise = userRepo
            .createQueryBuilder()
            .innerJoin("User.memberships", "OrganizationMembership")
            .innerJoin("OrganizationMembership.organization", "Organization")
            .innerJoin("OrganizationMembership.roles", "Role")
            .innerJoin("Role.permissions", "Permission")
            .innerJoin("Organization.classes", "Class")
            .where("Class.class_id = :class_id", {class_id: this.class_id})
            .andWhere("Permission.permission_name = :permission_name", {permission_name})
            .groupBy("User.user_id, OrganizationMembership.organization_id, Permission.permission_name")
            .having("bool_and(Permission.allow) = :allowed", {allowed: true})
            .getMany();

        const schoolPromise = userRepo
            .createQueryBuilder()
            .innerJoin("User.school_memberships", "SchoolMembership")
            .innerJoin("SchoolMembership.school", "School")
            .innerJoin("SchoolMembership.roles", "Role")
            .innerJoin("Role.permissions", "Permission")
            .innerJoin("School.classes", "Class")
            .where("Class.class_id = :class_id", {class_id: this.class_id})
            .andWhere("Permission.permission_name = :permission_name", {permission_name})
            .groupBy("User.user_id, SchoolMembership.school_id, Permission.permission_name")
            .having("bool_and(Permission.allow) = :allowed", {allowed: true})
            .getMany();

        const [organizationUsers, schoolUsers] = await Promise.all([organizationPromise, schoolPromise])

        for(const organizationUser of organizationUsers) { results.set(organizationUser.user_id, organizationUser) }
        for(const schoolUser of schoolUsers) { results.set(schoolUser.user_id, schoolUser) }
        
        return results.values()
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

    public async removeTeacher({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({organization_id}, PermissionName.delete_teacher_from_class_20446)

        try {
            if(info.operation.operation !== "mutation") { return null }

            const user = await getRepository(User).findOneOrFail({user_id})
            const classes  = (await user.classesTeaching) || []
            user.classesStudying = Promise.resolve(
                classes.filter(({class_id}) => class_id !== class_id)
            )
            await user.save()

            return true
        } catch(e) {
            console.error(e)
        }
        return false
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

    public async removeStudent({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({organization_id}, PermissionName.delete_student_from_class_roster_20445)

        try {
            if(info.operation.operation !== "mutation") { return null }

            const user = await getRepository(User).findOneOrFail({user_id})
            const classes  = (await user.classesStudying) || []
            user.classesStudying = Promise.resolve(
                classes.filter(({class_id}) => class_id !== class_id)
            )
            await user.save()

            return true
        } catch(e) {
            console.error(e)
        }
        return false
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

    public async removeSchool({school_id}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({organization_id}, PermissionName.edit_class_20334)

        try {
            if(info.operation.operation !== "mutation") { return null }

            const school = await getRepository(School).findOneOrFail({school_id})
            const classes  = (await school.classes) || []
            school.classes = Promise.resolve(
                classes.filter(({class_id}) => class_id !== class_id)
            )
            await school.save()

            return true
        } catch(e) {
            console.error(e)
        }
        return false
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