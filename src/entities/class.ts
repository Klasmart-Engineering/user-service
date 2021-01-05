import { GraphQLResolveInfo } from "graphql";
import {
    BaseEntity,
    Column,
    Check,
    Entity,
    Unique,
    getManager,
    getRepository,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import { Organization } from "./organization";
import { School } from "./school";
import { User } from "./user";
import { Context } from "../main";
import { PermissionName } from "../permissions/permissionNames";
import { Status } from "./status";

@Entity()
@Check(`"class_name" <> ''`)
@Unique(["class_name", "organization"])
export class Class extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    public class_id!: string

    @Column({nullable: false})
    public class_name?: String

    @Column({type: "enum", enum: Status, default: Status.ACTIVE})
    public status! : Status

    @ManyToOne(() => Organization, organization => organization.classes)
    public organization?: Promise<Organization>

    @ManyToMany(() => School, school => school.classes)
    public schools?: Promise<School[]>

    @ManyToMany(() => User, user => user.classesTeaching)
    public teachers?: Promise<User[]>

    @ManyToMany(() => User, user => user.classesStudying)
    public students?: Promise<User[]>

    @Column({ type: 'timestamp', nullable: true})
    public deleted_at?: Date

    public async set({class_name}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
          permisionContext,
          PermissionName.edit_class_20334
        )

        try {
            if(typeof class_name === "string") { this.class_name = class_name }

            await this.save()

            return this
        } catch(e) {
            console.error(e)
        }
    }


    public async eligibleTeachers({}: any, context: Context, info: GraphQLResolveInfo) {
        console.info(`Unauthenticated endpoint call eligibleTeachers by ${context.token?.id}`)

        return this._membersWithPermission(PermissionName.attend_live_class_as_a_teacher_186)
    }

    public  async eligibleStudents({}: any, context: Context, info: GraphQLResolveInfo) {
        console.info(`Unauthenticated endpoint call eligibleStudents by ${context.token?.id}`)

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

    public async editTeachers({teacher_ids}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.add_teachers_to_class_20226
        )
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_teacher_from_class_20446
        )

        try {
            var oldTeachers = await this.teachers || []
            oldTeachers = await Promise.all(oldTeachers.map(async (teacher : User) => {
                if(!teacher_ids.includes(teacher.user_id)){
                    const classes  = (await teacher.classesTeaching) || []
                    teacher.classesTeaching = Promise.resolve(
                        classes.filter(({class_id}) => class_id !== this.class_id)
                    )
                }

                return teacher
            }))

            const newTeachers = await Promise.all(teacher_ids.map(async (teacher_id : string) => {
                const teacher = await getRepository(User).findOneOrFail({user_id: teacher_id})
                const classes  = (await teacher.classesTeaching) || []
                classes.push(this)
                teacher.classesTeaching = Promise.resolve(classes)

                return teacher
            }))

            await getManager().transaction(async (manager) => {
                await manager.save(oldTeachers)
                await manager.save(newTeachers)
            })

            return newTeachers
        } catch(e) {
            console.error(e)
        }
    }

    public async addTeacher({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
          permisionContext,
          PermissionName.add_teachers_to_class_20226
        )

        try {
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
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = {
            organization_id: organization_id,
            school_ids: (await this.schools)?.map(x => x.school_id),
        }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_teacher_from_class_20446
        )

        try {
            const user = await getRepository(User).findOneOrFail({user_id})
            const classes  = (await user.classesTeaching) || []
            user.classesTeaching = Promise.resolve(
                classes.filter(({class_id}) => class_id !== class_id)
            )
            await user.save()

            return true
        } catch(e) {
            console.error(e)
        }
        return false
    }

    public async editStudents({student_ids}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.add_students_to_class_20225
        )
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_student_from_class_roster_20445
        )

        try {
            var oldStudents = await this.students || []
            oldStudents = await Promise.all(oldStudents.map(async (student : User) => {
                if(!student_ids.includes(student.user_id)){
                    const classes  = (await student.classesStudying) || []
                    student.classesStudying = Promise.resolve(
                        classes.filter(({class_id}) => class_id !== this.class_id)
                    )
                }

                return student
            }))

            const newStudents = await Promise.all(student_ids.map(async (student_id : string) => {
                const student = await getRepository(User).findOneOrFail({user_id: student_id})
                const classes  = (await student.classesStudying) || []
                classes.push(this)
                student.classesStudying = Promise.resolve(classes)

                return student
            }))

            await getManager().transaction(async (manager) => {
                await manager.save(oldStudents)
                await manager.save(newStudents)
            })

            return newStudents
        } catch(e) {
            console.error(e)
        }
    }

    public async addStudent({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
          permisionContext,
          PermissionName.add_students_to_class_20225
        )

        try {
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
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = {
            organization_id: organization_id,
            school_ids: (await this.schools)?.map(x => x.school_id),
        }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_student_from_class_roster_20445
        )

        try {
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

    public async editSchools({school_ids}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_school_20330
        )
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_class_20334
        )

        try {
            var oldSchools = await this.schools || []
            oldSchools = await Promise.all(oldSchools.map(async (school : School) => {
                if(!school_ids.includes(school.school_id)){
                    const classes  = (await school.classes) || []
                    school.classes = Promise.resolve(
                        classes.filter(({class_id}) => class_id !== this.class_id)
                    )
                }

                return school
            }))

            const newSchools = await Promise.all(school_ids.map(async (school_id : string) => {
                const school = await getRepository(School).findOneOrFail({school_id})
                const classes  = (await school.classes) || []
                classes.push(this)
                school.classes = Promise.resolve(classes)

                return school
            }))

            await getManager().transaction(async (manager) => {
                await manager.save(oldSchools)
                await manager.save(newSchools)
            })

            return newSchools
        } catch(e) {
            console.error(e)
        }
    }

    public async addSchool({school_id}: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
          permisionContext,
          PermissionName.edit_school_20330
        )

        try {
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
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = {
            organization_id: organization_id,
            school_ids: (await this.schools)?.map(x => x.school_id),
        }
        await context.permissions.rejectIfNotAllowed(
          permisionContext,
          PermissionName.edit_class_20334
        )

        try {
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
        const organization_id = (await this.organization)?.organization_id;
        if(info.operation.operation !== "mutation" || !organization_id || this.status == Status.INACTIVE) { return null }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
          permisionContext,
          PermissionName.delete_class_20444
        )

        try {
            await this.inactivate(getManager())

            return true
        } catch(e) {
            console.error(e)
        }
        return false
    }

    public async inactivate(manager : any){
        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await manager.save(this)
    }
}
