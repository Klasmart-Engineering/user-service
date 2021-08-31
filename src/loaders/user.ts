import { OrganizationMembership } from '../entities/organizationMembership'
import DataLoader from 'dataloader'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import { Class } from '../entities/class'

export interface IUsersLoaders {
    orgMemberships: DataLoader<string, OrganizationMembership[]>
    schoolMemberships: DataLoader<string, SchoolMembership[]>
    classesTeaching: DataLoader<string, Class[]>
    classesStudying: DataLoader<string, Class[]>
}

export const orgMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<OrganizationMembership[][]> => {
    const memberships: OrganizationMembership[][] = []

    const scope = OrganizationMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const data = await scope.getMany()

    for (const userId of userIds) {
        const userMemberships = data.filter((m) => m.user_id === userId)
        memberships.push(userMemberships)
    }

    return memberships
}

export const schoolMembershipsForUsers = async (
    userIds: readonly string[]
): Promise<SchoolMembership[][]> => {
    const schoolMemberships: SchoolMembership[][] = []

    const scope = SchoolMembership.createQueryBuilder().where(
        'user_id IN (:...ids)',
        { ids: userIds }
    )

    const data = await scope.getMany()

    for (const userId of userIds) {
        const userMemberships = data.filter((m) => m.user_id === userId)
        schoolMemberships.push(userMemberships)
    }

    return schoolMemberships
}

export const classesTeachingForUsers = async (
    userIds: readonly string[]
): Promise<Class[][]> => {
    const classesTeaching: Class[][] = []
    const scope = Class.createQueryBuilder()
        .innerJoin('Class.teachers', 'User')
        .andWhere('User.user_id in :user_ids', {
            user_ids: userIds,
        })

    const data = await scope.getMany()

    interface ClassTeachers {
        _class: Class
        teachers: User[] | undefined
    }
    const classesTeachers: ClassTeachers[] = []

    for (const _class of data) {
        const teachers = await _class.teachers
        const ct: ClassTeachers = {
            _class: _class,
            teachers: teachers,
        }
        classesTeachers.push(ct)
    }
    for (const userId of userIds) {
        const userClassesTeaching = classesTeachers.filter((ct) =>
            ct.teachers?.find((x) => x.user_id === userId)
        )
        classesTeaching.push(userClassesTeaching.map((a) => a._class))
    }
    return classesTeaching
}

export const classesStudyingForUsers = async (
    userIds: readonly string[]
): Promise<Class[][]> => {
    const classesStudying: Class[][] = []
    const scope = Class.createQueryBuilder()
        .innerJoin('Class.Studying', 'User')
        .andWhere('User.user_id in :user_ids', {
            user_ids: userIds,
        })

    const data = await scope.getMany()

    interface ClassStudents {
        _class: Class
        students: User[] | undefined
    }
    const classesStudents: ClassStudents[] = []

    for (const _class of data) {
        const students = await _class.students
        const cs: ClassStudents = {
            _class: _class,
            students: students,
        }
        classesStudents.push(cs)
    }

    for (const userId of userIds) {
        const userClassesTeaching = classesStudents.filter((cs) =>
            cs.students?.find((x) => x.user_id === userId)
        )
        classesStudying.push(userClassesTeaching.map((a) => a._class))
    }
    return classesStudying
}

export async function usersByIds(
    userIds: readonly string[]
): Promise<(User | undefined)[]> {
    const data = await User.findByIds(userIds as string[])

    const map = new Map(data.map((user) => [user.user_id, user]))

    return userIds.map((id) => map.get(id))
}
