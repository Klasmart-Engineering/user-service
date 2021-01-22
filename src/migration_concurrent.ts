import csvParser from 'csv-parser'
import fs from 'fs'
import { GraphQLResolveInfo } from 'graphql'
import path from 'path'
import { OrganizationMembership } from './entities/organizationMembership'
import { Role } from './entities/role'
import { Model } from './model'
import { organizationAdminRole } from './permissions/organizationAdmin'
import { parentRole } from './permissions/parent'
import { studentRole } from './permissions/student'
import { teacherRole } from './permissions/teacher'

const USER_INFO_FILE = path.join(__dirname, './userInfo.csv')

interface UserInfo {
    name: string
    email: string
    birthday: string | undefined
    role: string
    studentName: string
    studentBirthday: string | undefined
}

interface UserMigrationResult {
    userInfo: UserInfo
    membership: OrganizationMembership | null | undefined
    studentMembership: OrganizationMembership | null | undefined
}

async function main() {
    try {
        const model = await Model.create()
        await migrate(model)
        console.log('migration complete')
    } catch (e) {
        console.error(e)
        process.exit(-1)
    }
}

main()

async function migrate(model: Model) {
    //const organizationId = '740ec808-bd56-46c6-8bcb-babbe1666dc4'
    const admin = await model.newUser({
        given_name: 'Joe',
        family_name: 'Brown',
        email: 'admin@gmail.com',
        phone: undefined,
        avatar: undefined,
    })
    const organization = await admin.createOrganization(
        { organization_name: 'My Org' },
        undefined,
        {
            operation: { operation: 'mutation' },
        } as GraphQLResolveInfo
    )
    if (!organization) throw Error('createOrganization failed')

    let userInfoEntries = await getUserInfoEntriesFromCsv()
    await migrateUsers(model, organization.organization_id, userInfoEntries)
    console.log('parent, teacher, and admin migration complete')
}

async function migrateUsers(
    model: Model,
    organizationId: string,
    userInfoEntries: UserInfo[]
) {
    const context = undefined
    const info = {
        operation: { operation: 'mutation' },
    } as GraphQLResolveInfo

    const migrateUserPromises: Promise<UserMigrationResult>[] = []
    for (const userInfo of userInfoEntries) {
        const migrateUserPromise = migrateUser(
            userInfo,
            model,
            organizationId,
            context,
            info
        )
        migrateUserPromises.push(migrateUserPromise)
    }

    const userMigrationResults = await Promise.all(migrateUserPromises)
    await migrateRoles(userMigrationResults, organizationId)
}

async function migrateUser(
    userInfo: UserInfo,
    model: Model,
    organizationId: string,
    context: any,
    info: GraphQLResolveInfo
): Promise<UserMigrationResult> {
    const existingUserCount = await User.count({
        where: { email: userInfo.email },
    })

    if (existingUserCount > 0) [userInfo, undefined]

    let studentMembership: OrganizationMembership | null | undefined
    // if (userInfo.studentName !== '') {
    //     // TODO: Generate the ID differently.
    //     const studentUser = await model.newUser({
    //         given_name: userInfo.studentName,
    //         family_name: undefined,
    //         email: userInfo.email,
    //         phone: undefined,
    //         avatar: undefined,
    //     })
    //     studentMembership = await studentUser.addOrganization(
    //         { organization_id: organizationId },
    //         context,
    //         info
    //     )
    // }

    const user = await model.newUser({
        given_name: userInfo.name,
        family_name: undefined,
        email: userInfo.email,
        phone: undefined,
        avatar: undefined,
    })
    const membership = await user.addOrganization(
        { organization_id: organizationId },
        context,
        info
    )

    return {
        userInfo: userInfo,
        membership: membership,
        studentMembership: studentMembership,
    }
}

async function migrateRoles(
    userMigrationResults: UserMigrationResult[],
    organizationId: string
) {
    const orgStudentRole = await Role.findOneOrFail({
        where: {
            organization: organizationId,
            role_name: studentRole.role_name,
        },
    })
    const orgParentRole = await Role.findOneOrFail({
        where: {
            organization: organizationId,
            role_name: parentRole.role_name,
        },
    })
    const orgTeacherRole = await Role.findOneOrFail({
        where: {
            organization: organizationId,
            role_name: teacherRole.role_name,
        },
    })
    const orgAdminRole = await Role.findOneOrFail({
        where: {
            organization: organizationId,
            role_name: organizationAdminRole.role_name,
        },
    })

    const studentRoleMemberships = (await orgStudentRole.memberships) || []
    const parentRoleMemberships = (await orgParentRole.memberships) || []
    const teacherRoleMemberships = (await orgTeacherRole.memberships) || []
    const adminRoleMemberships = (await orgAdminRole.memberships) || []

    for (const migrationResult of userMigrationResults) {
        const userInfo = migrationResult.userInfo
        const membership = migrationResult.membership
        const studentMembership = migrationResult.studentMembership

        if (studentMembership) {
            studentRoleMemberships.push(studentMembership)
        }

        if (membership) {
            switch (userInfo.role) {
                case 'super':
                    adminRoleMemberships.push(membership)
                    break
                case 'teacher':
                    teacherRoleMemberships.push(membership)
                    break
                case 'parent':
                    parentRoleMemberships.push(membership)
                    break
                default:
                    console.log(
                        `Unexpected role encountered: ${userInfo.role}. Won't add a role for user ${userInfo.email}.`
                    )
            }
        }
    }

    orgStudentRole.memberships = Promise.resolve(studentRoleMemberships)
    orgParentRole.memberships = Promise.resolve(parentRoleMemberships)
    orgTeacherRole.memberships = Promise.resolve(teacherRoleMemberships)
    orgAdminRole.memberships = Promise.resolve(adminRoleMemberships)
    await orgStudentRole.save()
    await orgParentRole.save()
    await orgTeacherRole.save()
    await orgAdminRole.save()
}

async function getUserInfoEntriesFromCsv() {
    const userInfoEntries: UserInfo[] = []

    const _ = await new Promise((resolve) =>
        fs
            .createReadStream(USER_INFO_FILE)
            .pipe(csvParser())
            .on('data', (row: any) => {
                if (
                    // TODO: Log these values if typo.
                    row['deleted'] === 'FALSE' &&
                    row['deleted_by_kbt'] === 'FALSE'
                ) {
                    const birthDateString = getBirthDate(row['birthday'])
                    //const birthDateString = getBirthDate(row['birthday'])
                    userInfoEntries.push({
                        name: row['name'],
                        email: row['email'],
                        birthday: birthDateString,
                        role: row['role'],
                        studentName: row['student_name'],
                        studentBirthday: row['student_birthday'],
                    })
                }

                return row
            })
            .on('end', resolve)
    )

    return userInfoEntries
}

function getBirthDate(unixTime: number) {
    try {
        if (unixTime > 0) {
            const birthDate = new Date(unixTime * 1000)
            return dateToMMYYYY(birthDate)
        }
    } catch (e) {
        console.log(e)
    }
}

function dateToMMYYYY(date: Date) {
    var month = date.getMonth() + 1
    var year = date.getFullYear()
    return (month <= 9 ? '0' + month : month) + '-' + year
}
