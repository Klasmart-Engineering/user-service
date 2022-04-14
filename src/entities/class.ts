import { GraphQLResolveInfo } from 'graphql'
import {
    Column,
    Check,
    Entity,
    JoinTable,
    Unique,
    getManager,
    getRepository,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    In,
    RelationId,
    JoinColumn,
    SelectQueryBuilder,
} from 'typeorm'
import { AgeRange } from './ageRange'
import { Grade } from './grade'
import { Organization } from './organization'
import { School } from './school'
import { User } from './user'
import { Context } from '../main'
import { Program } from './program'
import { PermissionName } from '../permissions/permissionNames'
import { Status } from './status'
import { Subject } from './subject'
import { SHORTCODE_DEFAULT_MAXLEN, validateShortCode } from '../utils/shortcode'
import { CustomBaseEntity } from './customBaseEntity'
import logger from '../logging'
import { reportError } from '../utils/resolvers/errors'
import { AcademicTerm } from './academicTerm'
import { scopeHasJoin } from '../utils/typeorm'
import { OrganizationMembership } from './organizationMembership'
import { SchoolMembership } from './schoolMembership'

@Entity()
@Check(`"class_name" <> ''`)
@Unique(['class_name', 'organization'])
export class Class extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public class_id!: string

    @Column({ nullable: false })
    public class_name?: string

    @Column({ nullable: true, length: SHORTCODE_DEFAULT_MAXLEN })
    public shortcode?: string

    @ManyToOne(() => Organization, (organization) => organization.classes)
    public organization?: Promise<Organization>

    @RelationId((_class: Class) => _class.organization)
    public readonly organization_id?: string

    @ManyToMany(() => School, (school) => school.classes)
    public schools?: Promise<School[]>

    @ManyToMany(() => User, (user) => user.classesTeaching)
    public teachers?: Promise<User[]>

    @ManyToMany(() => User, (user) => user.classesStudying)
    public students?: Promise<User[]>

    @ManyToMany(() => Program, (program) => program.classes)
    @JoinTable()
    public programs?: Promise<Program[]>

    @ManyToMany(() => AgeRange, (ageRange) => ageRange.classes)
    @JoinTable()
    public age_ranges?: Promise<AgeRange[]>

    @ManyToMany(() => Grade, (grade) => grade.classes)
    @JoinTable()
    public grades?: Promise<Grade[]>

    @ManyToMany(() => Subject, (subject) => subject.classes)
    @JoinTable()
    public subjects?: Promise<Subject[]>

    @ManyToOne(() => AcademicTerm)
    @JoinColumn({ name: 'academic_term_id' })
    public academicTerm?: Promise<AcademicTerm | null>

    @RelationId((class_: Class) => class_.academicTerm)
    public readonly academic_term_id?: string

    public async set(
        { class_name, shortcode }: { class_name: string; shortcode: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )

        try {
            if (typeof class_name === 'string') {
                this.class_name = class_name
            }
            if (typeof shortcode === 'string') {
                shortcode = shortcode.toUpperCase()
                if (validateShortCode(shortcode)) {
                    this.shortcode = shortcode
                }
            }

            await this.save()

            return this
        } catch (e) {
            reportError(e as Error)
        }
    }

    public async eligibleTeachers(
        scope: SelectQueryBuilder<User>
    ): Promise<User[] | IterableIterator<User>> {
        const members = await this._membersWithPermission(
            PermissionName.attend_live_class_as_a_teacher_186,
            scope
        )
        return this.filterMembersForClass(members)
    }

    public async eligibleStudents(
        scope: SelectQueryBuilder<User>
    ): Promise<User[] | IterableIterator<User>> {
        const members = await this._membersWithPermission(
            PermissionName.attend_live_class_as_a_student_187,
            scope
        )
        return this.filterMembersForClass(members)
    }

    private async _membersWithPermission(
        permission_name: PermissionName,
        scope: SelectQueryBuilder<User>
    ) {
        const results = new Map<string, User>()
        const orgMemScope = scope.clone()
        const schoolMemScope = scope.clone()
        if (!scopeHasJoin(scope, OrganizationMembership)) {
            orgMemScope.leftJoin('User.memberships', 'OrganizationMembership')
        }
        const organizationPromise = orgMemScope
            .innerJoin('OrganizationMembership.organization', 'Organization')
            .innerJoin('OrganizationMembership.roles', 'Role')
            .innerJoin('Role.permissions', 'Permission')
            .innerJoin('Organization.classes', 'Class')
            .andWhere('Class.class_id = :class_id', { class_id: this.class_id })
            .andWhere('Permission.permission_name = :permission_name', {
                permission_name,
            })
            .groupBy(
                'User.user_id, OrganizationMembership.organization_id, Permission.permission_name'
            )
            .having('bool_and(Permission.allow) = :allowed', { allowed: true })
            .getMany()

        if (!scopeHasJoin(scope, SchoolMembership)) {
            schoolMemScope.leftJoin(
                'User.school_memberships',
                'SchoolMembership'
            )
        }
        const schoolPromise = schoolMemScope
            .innerJoin('SchoolMembership.school', 'School')
            .innerJoin('SchoolMembership.roles', 'Role')
            .innerJoin('Role.permissions', 'Permission')
            .innerJoin('School.classes', 'Class')
            .andWhere('Class.class_id = :class_id', { class_id: this.class_id })
            .andWhere('Permission.permission_name = :permission_name', {
                permission_name,
            })
            .groupBy(
                'User.user_id, SchoolMembership.school_id, Permission.permission_name'
            )
            .having('bool_and(Permission.allow) = :allowed', { allowed: true })
            .getMany()

        const [organizationUsers, schoolUsers] = await Promise.all([
            organizationPromise,
            schoolPromise,
        ])

        for (const organizationUser of organizationUsers) {
            results.set(organizationUser.user_id, organizationUser)
        }
        for (const schoolUser of schoolUsers) {
            results.set(schoolUser.user_id, schoolUser)
        }

        return results.values()
    }

    public async editTeachers(
        { teacher_ids }: { teacher_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.add_teachers_to_class_20226
        )
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_teacher_from_class_20446
        )

        try {
            let oldTeachers = (await this.teachers) || []
            oldTeachers = await Promise.all(
                oldTeachers.map(async (teacher: User) => {
                    if (!teacher_ids.includes(teacher.user_id)) {
                        const classes = (await teacher.classesTeaching) || []
                        teacher.classesTeaching = Promise.resolve(
                            classes.filter(
                                ({ class_id }) => class_id !== this.class_id
                            )
                        )
                    }

                    return teacher
                })
            )

            const newTeachers = await Promise.all(
                teacher_ids.map(async (teacher_id: string) => {
                    const teacher = await getRepository(User).findOneByOrFail({
                        user_id: teacher_id,
                    })

                    const classes = (await teacher.classesTeaching) || []
                    classes.push(this)
                    teacher.classesTeaching = Promise.resolve(classes)

                    return teacher
                })
            )

            await getManager().transaction(async (manager) => {
                await manager.save(oldTeachers)
                await manager.save(newTeachers)
            })

            return newTeachers
        } catch (e) {
            logger.warn(e)
        }
    }

    public async addTeacher(
        { user_id }: { user_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.add_teachers_to_class_20226
        )

        try {
            const user = await getRepository(User).findOneByOrFail({ user_id })
            const classes = (await user.classesTeaching) || []
            classes.push(this)
            user.classesTeaching = Promise.resolve(classes)
            await user.save()

            return user
        } catch (e) {
            logger.warn(e)
        }
    }

    public async removeTeacher(
        { user_id }: { user_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = {
            organization_ids: [organization_id],
            school_ids: (await this.schools)?.map((x) => x.school_id),
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_teacher_from_class_20446
        )

        try {
            const user = await getRepository(User).findOneByOrFail({ user_id })
            const classes = (await user.classesTeaching) || []
            user.classesTeaching = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== this.class_id)
            )
            await user.save()

            return true
        } catch (e) {
            logger.warn(e)
        }
        return false
    }

    public async editStudents(
        { student_ids }: { student_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.add_students_to_class_20225
        )
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_student_from_class_roster_20445
        )

        try {
            let oldStudents = (await this.students) || []
            oldStudents = await Promise.all(
                oldStudents.map(async (student: User) => {
                    if (!student_ids.includes(student.user_id)) {
                        const classes = (await student.classesStudying) || []
                        student.classesStudying = Promise.resolve(
                            classes.filter(
                                ({ class_id }) => class_id !== this.class_id
                            )
                        )
                    }

                    return student
                })
            )

            const newStudents = await Promise.all(
                student_ids.map(async (student_id: string) => {
                    const student = await getRepository(User).findOneByOrFail({
                        user_id: student_id,
                    })

                    const classes = (await student.classesStudying) || []
                    classes.push(this)
                    student.classesStudying = Promise.resolve(classes)

                    return student
                })
            )

            await getManager().transaction(async (manager) => {
                await manager.save(oldStudents)
                await manager.save(newStudents)
            })

            return newStudents
        } catch (e) {
            logger.warn(e)
        }
    }

    public async addStudent(
        { user_id }: { user_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.add_students_to_class_20225
        )

        try {
            const user = await getRepository(User).findOneByOrFail({ user_id })
            const classes = (await user.classesStudying) || []
            classes.push(this)
            user.classesStudying = Promise.resolve(classes)
            await user.save()

            return user
        } catch (e) {
            logger.warn(e)
        }
    }

    public async removeStudent(
        { user_id }: { user_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = {
            organization_ids: [organization_id],
            school_ids: (await this.schools)?.map((x) => x.school_id),
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_student_from_class_roster_20445
        )

        try {
            const user = await getRepository(User).findOneByOrFail({ user_id })
            const classes = (await user.classesStudying) || []
            user.classesStudying = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== this.class_id)
            )
            await user.save()

            return true
        } catch (e) {
            logger.warn(e)
        }
        return false
    }

    public async editSchools(
        { school_ids }: { school_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_school_20330
        )
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )

        try {
            let oldSchools = (await this.schools) || []
            oldSchools = await Promise.all(
                oldSchools.map(async (school: School) => {
                    if (!school_ids.includes(school.school_id)) {
                        const classes = (await school.classes) || []
                        school.classes = Promise.resolve(
                            classes.filter(
                                ({ class_id }) => class_id !== this.class_id
                            )
                        )
                    }

                    return school
                })
            )

            const newSchools = await Promise.all(
                school_ids.map(async (school_id: string) => {
                    const school = await getRepository(School).findOneByOrFail({
                        school_id,
                    })
                    const classes = (await school.classes) || []
                    classes.push(this)
                    school.classes = Promise.resolve(classes)

                    return school
                })
            )

            await getManager().transaction(async (manager) => {
                await manager.save(oldSchools)
                await manager.save(newSchools)
            })

            return newSchools
        } catch (e) {
            logger.warn(e)
        }
    }

    public async addSchool(
        { school_id }: { school_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_school_20330
        )

        try {
            const school = await getRepository(School).findOneByOrFail({
                school_id,
            })
            const classes = (await school.classes) || []
            classes.push(this)
            school.classes = Promise.resolve(classes)
            await school.save()

            return school
        } catch (e) {
            logger.warn(e)
        }
    }

    public async removeSchool(
        { school_id }: { school_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = {
            organization_ids: [organization_id],
            school_ids: (await this.schools)?.map((x) => x.school_id),
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )

        try {
            const school = await getRepository(School).findOneByOrFail({
                school_id,
            })

            const classes = (await school.classes) || []
            school.classes = Promise.resolve(
                classes.filter(({ class_id }) => class_id !== this.class_id)
            )
            await school.save()

            return true
        } catch (e) {
            logger.warn(e)
        }
        return false
    }

    public async editPrograms(
        { program_ids }: { program_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )

        const validPrograms: Program[] = await Class.getPrograms(program_ids)
        this.programs = Promise.resolve(validPrograms)

        await this.save()

        return validPrograms
    }

    public async editAgeRanges(
        { age_range_ids }: { age_range_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )

        const validAgeRanges: AgeRange[] = await Class.getAgeRanges(
            age_range_ids
        )
        this.age_ranges = Promise.resolve(validAgeRanges)

        await this.save()

        return validAgeRanges
    }

    public async editGrades(
        { grade_ids }: { grade_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )

        const validGrades: Grade[] = await Class.getGrades(grade_ids)
        this.grades = Promise.resolve(validGrades)

        await this.save()

        return validGrades
    }

    public async editSubjects(
        { subject_ids }: { subject_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_class_20334
        )

        const validSubjects: Subject[] = await Class.getSubjects(subject_ids)
        this.subjects = Promise.resolve(validSubjects)

        await this.save()

        return validSubjects
    }

    private static async getAgeRanges(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await AgeRange.find({
            where: { id: In(ids) },
        })
    }

    private static async getGrades(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Grade.find({
            where: { id: In(ids) },
        })
    }

    private static async getSubjects(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Subject.find({
            where: { id: In(ids) },
        })
    }

    private static async getPrograms(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Program.find({
            where: { id: In(ids) },
        })
    }

    public async delete(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_class_20444
        )

        try {
            await this.inactivate(getManager())

            return true
        } catch (e) {
            reportError(e as Error)
        }
        return false
    }

    // we should see users who are in the schools that the class belongs to, AND
    // we should see users who do not belong to any schools
    // https://calmisland.atlassian.net/browse/KL-4857
    private async filterMembersForClass(members: IterableIterator<User>) {
        const users: User[] = []
        const classSchools = (await this.schools) || []

        if (classSchools.length === 0) {
            // show all org users if the class has not been assigned to a school
            return members
        }

        let user = members.next()
        while (!user.done) {
            const schoolMemberships =
                (await user.value.school_memberships) || []
            if (schoolMemberships.length === 0) {
                users.push(user.value)
            } else {
                // find schools that have been assigned to both the class AND user
                for (const classSchool of classSchools) {
                    const userIsSchoolMember =
                        schoolMemberships.findIndex(
                            (s) => s.school_id === classSchool.school_id
                        ) >= 0
                    if (userIsSchoolMember) {
                        users.push(user.value)
                        break
                    }
                }
            }

            user = members.next()
        }

        return users
    }
}
