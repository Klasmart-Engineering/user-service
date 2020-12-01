import { GraphQLResolveInfo } from "graphql";
import { BaseEntity, Column, Entity, getRepository, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Organization } from "./organization";
import { School } from "./school";
import { User } from "./user";
import { UserProfile } from "./userprofile";
import { Context } from "../main";
import { PermissionName } from "../permissions/permissionNames";

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

    @ManyToMany(() => UserProfile, user_profile => user_profile.classesTeaching)
    public profileTeachers?: Promise<UserProfile[]>

    @ManyToMany(() => User, user => user.classesStudying)
    public students?: Promise<User[]>

    @ManyToMany(() => UserProfile, user_profile => user_profile.classesStudying)
    public profileStudents?: Promise<UserProfile[]>


    public async set({ class_name }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if (info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_class_20334
            )

            if (typeof class_name === "string") { this.class_name = class_name }

            await this.save()

            return this
        } catch (e) {
            console.error(e)
        }
    }

    public async eligibleTeachers({ }: any, context: Context, info: GraphQLResolveInfo) {
        return this._membersWithPermission(PermissionName.attend_live_class_as_a_teacher_186)
    }

    public async eligibleStudents({ }: any, context: Context, info: GraphQLResolveInfo) {
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
            .where("Class.class_id = :class_id", { class_id: this.class_id })
            .andWhere("Permission.permission_name = :permission_name", { permission_name })
            .groupBy("User.user_id, OrganizationMembership.organization_id, Permission.permission_name")
            .having("bool_and(Permission.allow) = :allowed", { allowed: true })
            .getMany();

        const schoolPromise = userRepo
            .createQueryBuilder()
            .innerJoin("User.school_memberships", "SchoolMembership")
            .innerJoin("SchoolMembership.school", "School")
            .innerJoin("SchoolMembership.roles", "Role")
            .innerJoin("Role.permissions", "Permission")
            .innerJoin("School.classes", "Class")
            .where("Class.class_id = :class_id", { class_id: this.class_id })
            .andWhere("Permission.permission_name = :permission_name", { permission_name })
            .groupBy("User.user_id, SchoolMembership.school_id, Permission.permission_name")
            .having("bool_and(Permission.allow) = :allowed", { allowed: true })
            .getMany();

        const [organizationUsers, schoolUsers] = await Promise.all([organizationPromise, schoolPromise])

        for (const organizationUser of organizationUsers) { results.set(organizationUser.user_id, organizationUser) }
        for (const schoolUser of schoolUsers) { results.set(schoolUser.user_id, schoolUser) }

        return results.values()
    }

    public async _profileMembersWithPermission(permission_name: PermissionName) {
        const results = new Map<string, UserProfile>()
        const userProfileRepo = getRepository(UserProfile)
        const organizationPromise = userProfileRepo
            .createQueryBuilder()
            .innerJoin("UserProfile.memberships", "ProfileOrganizationMembership")
            .innerJoin("ProfileOrganizationMembership.organization", "Organization")
            .innerJoin("ProfleOrganizationMembership.roles", "Role")
            .innerJoin("Role.permissions", "Permission")
            .innerJoin("Organization.classes", "Class")
            .where("Class.class_id = :class_id", { class_id: this.class_id })
            .andWhere("Permission.permission_name = :permission_name", { permission_name })
            .groupBy("UserProfile.user_profile_id, ProfileOrganizationMembership.organization_id, Permission.permission_name")
            .having("bool_and(Permission.allow) = :allowed", { allowed: true })
            .getMany();

        const schoolPromise = userProfileRepo
            .createQueryBuilder()
            .innerJoin("UserProfile.school_memberships", "ProfileSchoolMembership")
            .innerJoin("ProfileSchoolMembership.school", "School")
            .innerJoin("ProfileSchoolMembership.roles", "Role")
            .innerJoin("Role.permissions", "Permission")
            .innerJoin("School.classes", "Class")
            .where("Class.class_id = :class_id", { class_id: this.class_id })
            .andWhere("Permission.permission_name = :permission_name", { permission_name })
            .groupBy("UserProfile.user_profile_id, ProfileSchoolMembership.school_id, Permission.permission_name")
            .having("bool_and(Permission.allow) = :allowed", { allowed: true })
            .getMany();

        const [organizationUserProfiles, schoolUserProfiles] = await Promise.all([organizationPromise, schoolPromise])

        for (const organizationUserProfile of organizationUserProfiles) { results.set(organizationUserProfile.user_profile_id, organizationUserProfile) }
        for (const schoolUserProfile of schoolUserProfiles) { results.set(schoolUserProfile.user_profile_id, schoolUserProfile) }

        return results.values()
    }

    public async addTeacherProfile({ user_profile_id }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if (info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.add_teachers_to_class_20226
            )
            const userProfile = await getRepository(UserProfile).findOneOrFail({ user_profile_id })
            const classes = (await userProfile.classesTeaching) || []
            classes.push(this)
            userProfile.classesTeaching = Promise.resolve(classes)
            await userProfile.save()

            return userProfile
        } catch (e) {
            console.error(e)
        }
    }


    public async addTeacher({ user_id }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if (info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.add_teachers_to_class_20226
            )
            const user = await getRepository(User).findOneOrFail({ user_id })
            const classes = (await user.classesTeaching) || []
            classes.push(this)
            user.classesTeaching = Promise.resolve(classes)
            await user.save()

            return user
        } catch (e) {
            console.error(e)
        }
    }

    public async removeTeacher({ user_id }: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({ organization_id }, PermissionName.delete_teacher_from_class_20446)

        try {
            if (info.operation.operation !== "mutation") { return null }

            const user = await getRepository(User).findOneOrFail({ user_id })
            const classes = (await user.classesTeaching) || []
            user.classesStudying = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== class_id)
            )
            await user.save()

            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

    public async removeTeacherProfile({ user_profile_id }: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({ organization_id }, PermissionName.delete_teacher_from_class_20446)

        try {
            if (info.operation.operation !== "mutation") { return null }

            const userProfile = await getRepository(UserProfile).findOneOrFail({ user_profile_id })
            const classes = (await userProfile.classesTeaching) || []
            userProfile.classesStudying = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== class_id)
            )
            await userProfile.save()

            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

    public async addStudent({ user_id }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if (info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.add_students_to_class_20225
            )
            const user = await getRepository(User).findOneOrFail({ user_id })
            const classes = (await user.classesStudying) || []
            classes.push(this)
            user.classesStudying = Promise.resolve(classes)
            await user.save()

            return user
        } catch (e) {
            console.error(e)
        }
    }

    public async addStudentProfile({ user_profile_id }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if (info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.add_students_to_class_20225
            )
            const userProfile = await getRepository(UserProfile).findOneOrFail({ user_profile_id })
            const classes = (await userProfile.classesStudying) || []
            classes.push(this)
            userProfile.classesStudying = Promise.resolve(classes)
            await userProfile.save()

            return userProfile
        } catch (e) {
            console.error(e)
        }
    }

    public async removeStudent({ user_id }: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({ organization_id }, PermissionName.delete_student_from_class_roster_20445)

        try {
            if (info.operation.operation !== "mutation") { return null }

            const user = await getRepository(User).findOneOrFail({ user_id })
            const classes = (await user.classesStudying) || []
            user.classesStudying = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== class_id)
            )
            await user.save()

            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

    public async removeStudentProfile({ user_profile_id }: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({ organization_id }, PermissionName.delete_student_from_class_roster_20445)

        try {
            if (info.operation.operation !== "mutation") { return null }

            const userProfile = await getRepository(UserProfile).findOneOrFail({ user_profile_id })
            const classes = (await userProfile.classesStudying) || []
            userProfile.classesStudying = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== class_id)
            )
            await userProfile.save()

            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

    public async addSchool({ school_id }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if (info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.edit_school_20330
            )
            const school = await getRepository(School).findOneOrFail({ school_id })
            const classes = (await school.classes) || []
            classes.push(this)
            school.classes = Promise.resolve(classes)
            await school.save()

            return school
        } catch (e) {
            console.error(e)
        }
    }

    public async removeSchool({ school_id }: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        //TODO: provide way to check permission for many schools
        await context.permissions.rejectIfNotAllowed({ organization_id }, PermissionName.edit_class_20334)

        try {
            if (info.operation.operation !== "mutation") { return null }

            const school = await getRepository(School).findOneOrFail({ school_id })
            const classes = (await school.classes) || []
            school.classes = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== class_id)
            )
            await school.save()

            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

    public async delete({ }: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization
            if (info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
                permisionContext,
                PermissionName.delete_class_20444
            )
            await this.remove()
            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

}