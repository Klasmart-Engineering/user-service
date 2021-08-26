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
import { expect } from 'chai'
import { createTestConnection } from '../../utils/testConnection'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { generateShortCode } from '../../../src/utils/shortcode'
import validationConstants from '../../../src/entities/validations/constants'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { Connection } from 'typeorm'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'

describe('User Dataloaders', () => {
    const numUsers = 5
    let users: User[]
    let orgs: Organization[]
    let schools: School[]

    let orgMemberships: OrganizationMembership[][]
    let schoolMemberships: SchoolMembership[][]

    let connection: Connection
    before(async () => {
        connection = await createTestConnection()
    })
    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        users = await User.save(Array.from(Array(numUsers), createUser))
        orgs = await Organization.save(
            Array.from(Array(numUsers), createOrganization)
        )
        schools = await School.save(
            Array.from(Array(numUsers), (v: unknown, i: number) =>
                createSchool(orgs[i])
            )
        )

        // add each user to a different org & school
        for (let i = 0; i < numUsers; i++) {
            await createOrganizationMembership({
                user: users[i],
                organization: orgs[i],
            }).save()
            await createSchoolMembership({
                user: users[i],
                school: schools[i],
            }).save()
        }

        orgMemberships = await orgMembershipsForUsers(
            users.map((u) => u.user_id)
        )
        schoolMemberships = await schoolMembershipsForUsers(
            users.map((u) => u.user_id)
        )
    })

    describe('#orgMembershipsForUsers', () => {
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
