// this offers a way to generate fake database entries using our factory methods
// that can be used for manually testing
// for example, to examine SQL query performance
// modify `populate` to generate rows that matter for whatever you are testing
/* eslint no-console: off */
import { User } from '../src/entities/user'
import { createOrganization } from './factories/organization.factory'
import { createSchool } from './factories/school.factory'
import { createSchoolMembership } from './factories/schoolMembership.factory'
import { createUser } from './factories/user.factory'
import { createTestConnection, TestConnection } from './utils/testConnection'

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

async function populate() {
    const connection = await createTestConnection()
    // call whatever factory code you want to populate your test scenario
    await makeSchoolsWithRangeOfMemberCounts(connection)
}

void populate()
