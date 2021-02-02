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

interface UserInfo {
    name: string
    email: string
    role: string
}

async function main() {
    try {
        await remove_users_from_organization()
        console.log('migration complete')
    } catch (e) {
        console.error(e)
        process.exit(-1)
    }
}

main()

async function remove_users_from_organization() {
    const connection = await getConn()

    const organization = await getRealOrganization()
    //const organization = await getDummyOrganization()

    const userInfoEntries = await getUserInfoEntriesFromCsv()

    const memberships = await OrganizationMembership.find({
        where: { organization_id: organization.organization_id },
    })
    const membershipsByUserId = new Map(memberships.map((x) => [x.user_id, x]))

    const userPromises: Promise<User>[] = []
    for (const membership of memberships) {
        const userPromise = User.findOneOrFail(membership.user_id)
        userPromises.push(userPromise)
    }
    const users = await Promise.all(userPromises)
    const usersById = new Map(users.map((x) => [x.user_id, x]))
    const usersByEmail = new Map(
        users.filter((x) => x.email !== undefined).map((x) => [x.email, x])
    )

    await connection.transaction(async (entityManager) => {
        for (const userInfo of userInfoEntries) {
            const userId = accountUUID(userInfo.email)
            let membership = membershipsByUserId.get(userId)
            if (membership) {
                const userByEmail = usersByEmail.get(userInfo.email)
                //membership = membershipsByUserId.get(userByEmail?.user_id)
                //const userFoundById = usersById.get(userId)
            }
            // else {
            //     const userByEmail = usersByEmail.get(userInfo.email)
            // }

            if (!membership) continue

            await entityManager.remove(membership)
        }
    })
}

async function getRealOrganization() {
    const organizationId = '78350c3c-37f9-4d52-b24e-c76b374a8312' //'740ec808-bd56-46c6-8bcb-babbe1666dc4'
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
            synchronize: false,
            dropSchema: false,
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
                userInfoEntries.push({
                    name: row['name'],
                    email: row['email'],
                    role: row['role'],
                })

                return row
            })
            .on('end', resolve)
    )

    return userInfoEntries
}
