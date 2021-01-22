import csvParser from 'csv-parser'
import fs from 'fs'
import { GraphQLResolveInfo } from 'graphql'
import path from 'path'
import { createConnection, getManager } from 'typeorm'
import { v4 } from 'uuid'
import { Organization } from './entities/organization'
import { OrganizationMembership } from './entities/organizationMembership'
import { accountUUID, User } from './entities/user'

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
        await migrate()
        console.log('migration complete')
    } catch (e) {
        console.error(e)
        process.exit(-1)
    }
}

main()

async function migrate() {
    const connection = await getConn()

    //const organization = await getRealOrganization()
    const organization = await getDummyOrganization()

    const emailSet = new Set<string>()
    const roles = await organization.roles
    if (!roles) {
        console.log('Organization roles property was undefined. Aborting...')
        return
    }
    const roleMap = new Map(roles.map((x) => [x.role_name, x]))

    const studentEntries = await getStudentInfoEntriesFromCsv()
    const userInfoEntries = await getUserInfoEntriesFromCsv()
    const allUserInfoEntries = studentEntries.concat(userInfoEntries)

    await connection.transaction(async (entityManager) => {
        for (const userInfo of allUserInfoEntries) {
            const user = new User()
            user.given_name = userInfo.name
            user.date_of_birth = userInfo.birthday
            user.email = userInfo.email
            user.user_id = emailSet.has(user.email)
                ? v4()
                : accountUUID(user.email)
            emailSet.add(user.email)

            const membership = new OrganizationMembership()
            membership.organization_id = organization.organization_id
            membership.organization = Promise.resolve(organization)
            membership.user_id = user.user_id
            membership.user = Promise.resolve(user)
            const role = roleMap.get(userInfo.role)
            if (!role) {
                console.log(
                    `role [${userInfo.role}] wasn't found for user ${userInfo.email}. Skipping...`
                )
                continue
            }

            membership.roles = Promise.resolve([role])
            //user.memberships = Promise.resolve([membership])
            await entityManager.save([user, membership])
        }
    })
}

async function getRealOrganization() {
    const organizationId = '740ec808-bd56-46c6-8bcb-babbe1666dc4'
    return await Organization.findOneOrFail({
        where: { organization_id: organizationId },
    })
}

async function getDummyOrganization() {
    const admin = new User()
    admin.given_name = 'Joe'
    admin.email = 'joe@gmail.com'
    admin.user_id = accountUUID(admin.email)
    await getManager().save(admin)
    const organization = await admin.createOrganization(
        { organization_name: 'My Org' },
        undefined,
        {
            operation: { operation: 'mutation' },
        } as GraphQLResolveInfo
    )

    if (!organization) throw Error('createOrganization failed')

    return organization
}

async function getConn() {
    try {
        const connection = await createConnection({
            name: 'default',
            type: 'postgres',
            host: 'localhost',
            username: 'postgres',
            password: 'kidsloop',
            database: 'testmigrationdb',
            // url:
            //     process.env.DATABASE_URL ||
            //     'postgres://postgres:kidsloop@localhost',
            synchronize: true,
            dropSchema: true,
            logging: Boolean(process.env.DATABASE_LOGGING),
            entities: ['src/entities/*.ts'],
        })
        console.log('🐘 Connected to postgres')
        return connection
    } catch (e) {
        console.log('❌ Failed to connect or initialize postgres')
        throw e
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
                        role: 'Student',
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
