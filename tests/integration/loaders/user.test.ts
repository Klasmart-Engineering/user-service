import { expect } from 'chai'
import faker from 'faker'
import { pick } from 'lodash'
import { Connection } from 'typeorm'
import { Organization } from '../../../src/entities/organization'
import { User } from '../../../src/entities/user'
import { School } from '../../../src/entities/school'
import { createUser } from '../../factories/user.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createSchool } from '../../factories/school.factory'
import {
    orgMembershipsForUsers,
    schoolMembershipsForUsers,
} from '../../../src/loaders/user'
import { createTestConnection } from '../../utils/testConnection'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { usersByIds } from '../../../src/loaders/user'

context('User loaders', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    describe('memberships', () => {
        const numUsers = 5
        let users: User[]
        let orgs: Organization[]
        beforeEach(async () => {
            users = await User.save(Array.from(Array(numUsers), createUser))
            orgs = await Organization.save(
                Array.from(Array(numUsers), createOrganization)
            )
        })

        describe('#orgMembershipsForUsers', () => {
            let orgMemberships: OrganizationMembership[][]

            beforeEach(async () => {
                // add each user to a different org
                for (let i = 0; i < numUsers; i++) {
                    await createOrganizationMembership({
                        user: users[i],
                        organization: orgs[i],
                    }).save()
                }
                orgMemberships = await orgMembershipsForUsers(
                    users.map((u) => u.user_id)
                )
            })

            it('always returns an array of equal length', async () => {
                expect(orgMemberships.length).to.eq(users.length)
            })
            it('returns all org memberships for the requested users in order', async () => {
                for (let i = 0; i < numUsers; i++) {
                    const memberships = orgMemberships[i]
                    expect(memberships.length).to.eq(1)
                    expect(memberships[0].organization_id).to.eq(
                        orgs[i].organization_id
                    )
                }
            })
        })
        describe('#schoolMembershipsForUsers', () => {
            let schoolMemberships: SchoolMembership[][]
            let schools: School[]

            beforeEach(async () => {
                schools = await School.save(
                    Array.from(Array(numUsers), (v: unknown, i: number) =>
                        createSchool(orgs[i])
                    )
                )
                // add each user to a different school
                for (let i = 0; i < numUsers; i++) {
                    await createSchoolMembership({
                        user: users[i],
                        school: schools[i],
                    }).save()
                }
                schoolMemberships = await schoolMembershipsForUsers(
                    users.map((u) => u.user_id)
                )
            })

            it('always returns an array of equal length', async () => {
                expect(schoolMemberships.length).to.eq(users.length)
            })
            it('returns all school memberships for the requested users in order', async () => {
                for (let i = 0; i < numUsers; i++) {
                    const memberships = schoolMemberships[i]
                    expect(memberships.length).to.eq(1)
                    expect(memberships[0].school_id).to.eq(schools[i].school_id)
                }
            })
        })
    })

    context('usersByIds', () => {
        let users: User[]

        function extractUserData(user: User | undefined) {
            if (user === undefined) return undefined
            return pick(user, [
                'user_id',
                'given_name',
                'family_name',
                'username',
                'email',
                'phone',
                'date_of_birth',
                'gender',
                'status',
            ])
        }

        beforeEach(async () => {
            users = await User.save(Array(3).fill(null).map(createUser))
        })

        it('always returns an array of equal length', async () => {
            const loadedUsers = (
                await usersByIds([
                    users[0].user_id,
                    faker.random.uuid(),
                    users[1].user_id,
                    faker.random.uuid(),
                ])
            ).map(extractUserData)

            expect(loadedUsers).to.deep.equal(
                [users[0], undefined, users[1], undefined].map(extractUserData)
            )
        })

        it('returns the expected data in order', async () => {
            // DB by default would return in A-Z `id` order, test the reverse
            const sortedUsers = users
                .sort((a, b) => -a.user_id.localeCompare(b.user_id))
                .map(extractUserData)

            const loadedUsers = (
                await usersByIds(sortedUsers.map((u) => u!.user_id))
            ).map(extractUserData)

            expect(loadedUsers).to.deep.equal(sortedUsers)
        })
    })
})
