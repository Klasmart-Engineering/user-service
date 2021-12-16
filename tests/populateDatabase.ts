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
import RoleInitializer from '../src/initializers/roles'
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
import { createRole } from './factories/role.factory'
import { PermissionName } from '../src/permissions/permissionNames'
import { School } from '../src/entities/school'
import { createClass } from './factories/class.factory'
import { Class } from '../src/entities/class'
import { truncateTables } from './utils/database'

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

async function createFakeOrgWithUsersSchoolsClasses(
    connection: TestConnection,
    numberOfUsers: number,
    numberOfSchools: number,
    numberOfClasses: number
) {
    const org = createOrganization()
    org.organization_name = 'Chrysalis Digital'
    await connection.manager.save(org)
    const users: User[] = []
    const orgMemberships: OrganizationMembership[] = []
    const schools: School[] = []
    const classes: Class[] = []

    // Populate database with users
    for (let i = 0; i < numberOfUsers; i++) {
        users.push(createUser())
    }
    await connection.manager.save(users)

    // Initialise standard roles and permissions
    await RoleInitializer.run()

    const role = await createRole('GT Teacher', org, {
        permissions: [PermissionName.attend_live_class_as_a_teacher_186],
    }).save()
    // Then create their org memberships to the org
    for (const user of users) {
        orgMemberships.push(
            createOrganizationMembership({
                user: user,
                organization: org,
                roles: [role],
            })
        )
    }
    await connection.manager.save(orgMemberships)

    // Create schools under the org. Name one of them explicitly
    for (let i = 0; i < numberOfSchools; i++) {
        let specificSchoolName: string | undefined
        if (i == 0) {
            specificSchoolName = 'Chrysalis Golden Ticket'
        } else {
            specificSchoolName = undefined
        }
        schools.push(createSchool(org, specificSchoolName))
    }
    await connection.manager.save(schools)

    // Create classes under the org and in 'Chrysalis Golden Ticket' school
    for (let i = 0; i < numberOfClasses; i++) {
        let class_: Class
        if (i == 0) {
            class_ = createClass([schools[0]], org)
            class_.class_name = 'Golden Ticket Class'
        } else {
            class_ = createClass([schools[0]], org)
            class_.class_name = `Class C${i}`
        }
        classes.push(class_)
    }
    await connection.manager.save(classes)

    return org
}

async function uploadFakeUsersFromCSV(
    connection: TestConnection,
    clientOrg: Organization
) {
    const mimetype = 'text/csv'
    const encoding = '7bit'
    const filename = 'users100.csv'

    // Set up server and test client
    const server = await createServer(new Model(connection))
    const testClient = await createTestClient(server)

    // Fetch users CSV file
    const file = fs.createReadStream(resolve(`tests/fixtures/${filename}`))

    // Create user to be the uploading user - they must be part of the org
    const clientUser = await createUser({
        given_name: 'Chrysalis',
        family_name: 'Frostmaker',
    }).save()
    const uploadRole = await createRole('Organization Admin', clientOrg, {
        permissions: [PermissionName.upload_users_40880],
    }).save()
    await createOrganizationMembership({
        user: clientUser,
        organization: clientOrg,
        roles: [uploadRole],
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
    const clientOrg = await createFakeOrgWithUsersSchoolsClasses(
        connection,
        4000,
        20,
        20
    )
    console.log('START LOGGING CALL COUNTS TO DB')
    connection.logger.reset()
    await uploadFakeUsersFromCSV(connection, clientOrg)
    console.log('END:')
    console.log(connection.logger.count)
    connection.logger.reset()
    await truncateTables(connection)
}

void populate()
