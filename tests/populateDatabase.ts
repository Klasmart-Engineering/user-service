// this offers a way to generate fake database entries using our factory methods
// that can be used for manually testing
// for example, to examine SQL query performance
// modify `populate` to generate rows that matter for whatever you are testing
/* eslint no-console: off */
import { ReadStream } from 'typeorm/platform/PlatformTools'
import { OrganizationMembership } from '../src/entities/organizationMembership'
import { User } from '../src/entities/user'
import { generateToken } from './utils/testConfig'
import { createOrganization } from './factories/organization.factory'
import { createOrganizationMembership } from './factories/organizationMembership.factory'
import { createSchool } from './factories/school.factory'
import { createSchoolMembership } from './factories/schoolMembership.factory'
import { createUser } from './factories/user.factory'
import { getNonAdminAuthToken } from './utils/testConfig'
import { createTestConnection, TestConnection } from './utils/testConnection'
import fs from 'fs'
import { resolve } from 'path'
import {
    ApolloServerTestClient,
    createTestClient,
} from './utils/createTestClient'
import { uploadUsers } from './utils/operations/csv/uploadUsers'
import { createServer } from '../src/utils/createServer'
import { Model } from '../src/model'
import { userToPayload } from './utils/operations/userOps'
import { Organization } from '../src/entities/organization'

// creates numberOfSetsSchoolSets of sizeOfSchoolSets schools each with an increasing number of members
// 301 schools with 1 member each
// 301 schools with 50 members each
// ...
// 301 schools with 1001 members each
async function makeSchoolsWithRangeOfMemberCounts(
    connection: TestConnection,
    sizeOfSchoolSets = 301,
    numberOfSetsSchoolSets = 10,
    userIncrement = 100
) {
    const org = await createOrganization().save()
    const users: User[] = []
    const totalNumberOfUsers = numberOfSetsSchoolSets * userIncrement
    for (let userCount = 0; userCount < totalNumberOfUsers; userCount++) {
        users.push(createUser())
    }
    await Promise.all(users.map((u) => u.save()))

    const start = Date.now()
    const schoolSetsDone = []

    for (
        let userDataPoint = 0;
        userDataPoint < numberOfSetsSchoolSets;
        userDataPoint += 1
    ) {
        const usersPerSchool = userDataPoint * userIncrement + 1
        const schoolSet = [...Array(sizeOfSchoolSets)].map(() =>
            createSchool(org)
        )
        const schoolSetSaved = connection.manager.save(schoolSet)
        const schoolSetDone = schoolSetSaved
            .then((schools) => {
                const membershipPromises = schools.map((school) => {
                    const memberships = [...Array(usersPerSchool).keys()].map(
                        (userIndex) =>
                            createSchoolMembership({
                                user: users[userIndex],
                                school,
                                roles: [],
                            })
                    )
                    return connection.manager.save(memberships)
                })
                return Promise.all(membershipPromises)
            })
            .then(() => {
                console.log(`Took ${(Date.now() - start) / 1000}s to make`)
                console.log(
                    `${sizeOfSchoolSets} schools with ${usersPerSchool} members`
                )
            })
        schoolSetsDone.push(schoolSetDone)
    }
    await Promise.all(schoolSetsDone)
}

async function createFakeOrganizationWithUsers(
    connection: TestConnection,
    numberOfUsers: number
) {
    const org = await createOrganization().save()
    org.organization_name = 'Chrysalis Digital'
    const users: User[] = []
    const orgMemberships: OrganizationMembership[] = []

    // Populate database with users
    for (let i = 0; i < numberOfUsers; i++) {
        users.push(createUser())
    }
    await connection.manager.save(users)

    // Then create their org memberships to the org
    for (const user of users) {
        orgMemberships.push(
            createOrganizationMembership({
                user: user,
                organization: org,
            })
        )
    }
    await connection.manager.save(orgMemberships)
    return org
}

async function uploadFakeUsersFromCSV(
    connection: TestConnection,
    clientOrg: Organization
) {
    let file: ReadStream
    let testClient: ApolloServerTestClient
    const mimetype = 'text/csv'
    const encoding = '7bit'
    const filename = 'users100.csv'

    // Set up server and test client
    const server = await createServer(new Model(connection))
    testClient = await createTestClient(server)

    // Fetch users CSV file
    file = fs.createReadStream(resolve(`tests/fixtures/${filename}`))

    // Create user to be the uploading user - they must be part of the org
    const clientUser = await createUser({
        given_name: 'Chrysalis',
        family_name: 'Frostmaker',
    }).save()
    await createOrganizationMembership({
        user: clientUser,
        organization: clientOrg,
    }).save()

    // Simulate uploading users CSV
    await uploadUsers(testClient, file, filename, mimetype, encoding, false, {
        authorization: generateToken(userToPayload(clientUser)),
    })
}

async function populate() {
    const connection = await createTestConnection()
    // call whatever factory code you want to populate your test scenario
    // await makeSchoolsWithRangeOfMemberCounts(connection)
    const clientOrg = await createFakeOrganizationWithUsers(connection, 4000)
    await uploadFakeUsersFromCSV(connection, clientOrg)
}

void populate()
