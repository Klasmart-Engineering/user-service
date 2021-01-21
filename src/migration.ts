import csvParser from 'csv-parser'
import fs from 'fs'
import { GraphQLResolveInfo } from 'graphql'
import path from 'path'
import { Role } from './entities/role'
import { User } from './entities/user'
import { Model } from './model'
import { organizationAdminRole } from './permissions/organizationAdmin'
import { parentRole } from './permissions/parent'
import { studentRole } from './permissions/student'
import { teacherRole } from './permissions/teacher'

const USER_INFO_FILE = path.join(__dirname, './userInfo.csv')
const STUDENT_INFO_FILE = path.join(__dirname, './studentInfo.csv')

interface UserInfo {
    name: string
    email: string
    birthday: string | undefined
    role: string
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
    const organizationId = (
        await admin.createOrganization(
            { organization_name: 'My Org' },
            undefined,
            {
                operation: { operation: 'mutation' },
            } as GraphQLResolveInfo
        )
    )?.organization_id
    if (!organizationId) throw Error('createOrganization failed')

    // const userInfoEntries = await getUserInfoEntriesFromCsv()
    // await migrateUsers(model, userInfoEntries)
    //console.log('parent, teacher, and admin migration complete')

    const studentInfoEntries = await getStudentInfoEntriesFromCsv()
    await migrateUsers(model, organizationId, studentInfoEntries)
    console.log('student migration complete')
}

async function migrateUsers(
    model: Model,
    organizationId: string,
    userInfoEntries: UserInfo[]
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

    const context = undefined
    const info = {
        operation: { operation: 'mutation' },
    } as GraphQLResolveInfo

    for (const x of userInfoEntries) {
        const existingUserCount = await User.count({
            where: { email: x.email },
        })

        if (existingUserCount > 0) continue

        const user = await model.newUser({
            given_name: x.name,
            family_name: undefined,
            email: x.email,
            phone: undefined,
            avatar: undefined,
        })
        const membership = await user.addOrganization(
            { organization_id: organizationId },
            context,
            info
        )

        if (!membership) continue

        let roleId = ''
        switch (x.role) {
            case 'super':
                roleId = orgAdminRole.role_id
                break
            case 'teacher':
                roleId = orgTeacherRole.role_id
                break
            case 'student':
                roleId = orgStudentRole.role_id
                break
            case 'parent':
                roleId = orgParentRole.role_id
                break
            default:
                console.log(
                    `Unexpected role encountered: ${x.role}. Won't add a role for user ${x.email}.`
                )
                continue
        }

        await membership.addRole({ role_id: roleId }, context, info)
    }
}

async function getUserInfoEntriesFromCsv() {
    const userInfoEntries: UserInfo[] = []

    const _ = await new Promise((resolve) =>
        fs
            .createReadStream(USER_INFO_FILE)
            .pipe(csvParser())
            .on('data', (row: any) => {
                if (
                    row['deleted'] === 'FALSE' &&
                    row['deleted_by_kbt'] === 'FALSE'
                ) {
                    const birthDateString = getBirthDate(row['birthday'])
                    userInfoEntries.push({
                        name: row['name'],
                        email: row['email'],
                        birthday: birthDateString,
                        role: row['role'],
                    })
                }

                return row
            })
            .on('end', resolve)
    )

    return userInfoEntries
}

async function getStudentInfoEntriesFromCsv() {
    const studentInfoEntries: UserInfo[] = []

    const _ = await new Promise((resolve) =>
        fs
            .createReadStream(STUDENT_INFO_FILE)
            .pipe(csvParser())
            .on('data', (row: any) => {
                if (
                    row['deleted'] === 'FALSE' &&
                    row['parent_deleted'] === 'FALSE' &&
                    row['parent_deleted_by_kbt'] === 'FALSE'
                ) {
                    const birthDateString = getBirthDate(row['birthday'])
                    studentInfoEntries.push({
                        name: row['student_name'],
                        email: row['parent_email'],
                        birthday: birthDateString,
                        role: 'student',
                    })
                }

                return row
            })
            .on('end', resolve)
    )

    return studentInfoEntries
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
