import { expect } from 'chai'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Permission } from '../../../src/entities/permission'
import { School } from '../../../src/entities/school'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { User } from '../../../src/entities/user'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createPermission } from '../../factories/permission.factory'
import { createSchool } from '../../factories/school.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createUser } from '../../factories/user.factory'
import { truncateTables } from '../../utils/database'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'

context('database', () => {
    let connection: TestConnection
    before(async () => {
        connection = await createTestConnection()
    })
    after(async () => {
        await connection?.close()
    })
    afterEach(async () => {
        await truncateTables(connection)
    })
    context('truncateTables', () => {
        context('default', () => {
            it('deletes all records for all Entities', async () => {
                const user = await createUser().save()
                const organization = await createOrganization().save()
                await createOrganizationMembership({
                    user,
                    organization,
                }).save()
                const school = await createSchool(organization).save()
                await createSchoolMembership({ user, school }).save()
                await createPermission().save()

                await truncateTables(connection)

                expect(
                    (
                        await Promise.all([
                            User.count(),
                            Organization.count(),
                            OrganizationMembership.count(),
                            School.count(),
                            SchoolMembership.count(),
                            Permission.count(),
                        ])
                    ).every((count) => count === 0)
                ).to.equal(true)
            })
        })
        context('single table', () => {
            it('deletes all records in the target table', async () => {
                const user = await createUser().save()
                const organization = await createOrganization().save()
                const school = await createSchool(organization).save()
                await createSchoolMembership({ user, school }).save()

                await truncateTables(connection, [School])

                const [
                    schools,
                    users,
                    schoolMemberships,
                    organizations,
                ] = await Promise.all([
                    School.count(),
                    User.count(),
                    SchoolMembership.count(),
                    Organization.count(),
                ])

                expect(schools).to.equal(0, 'Specified Entity table is cleared')
                expect(schoolMemberships).to.equal(
                    0,
                    'Relations are CASCADE deleted'
                )
                expect(
                    [users, organizations].every((count) => count === 1),
                    'Unspecified Entities are preserved'
                ).to.be.true
            })
        })
        context('multiple tables', () => {
            it('deletes all records for the specified Entity tables', async () => {
                const user = await createUser().save()
                const organization = await createOrganization().save()
                await createOrganizationMembership({
                    user,
                    organization,
                }).save()
                const school = await createSchool(organization).save()
                await createSchoolMembership({ user, school }).save()

                await truncateTables(connection, [
                    School,
                    OrganizationMembership,
                ])

                const [
                    users,
                    organizationMemberships,
                    organizations,
                    schools,
                    schoolMemberships,
                ] = await Promise.all([
                    User.count(),
                    OrganizationMembership.count(),
                    Organization.count(),
                    School.count(),
                    SchoolMembership.count(),
                ])

                expect(
                    [organizationMemberships, schools].every(
                        (count) => count === 0
                    ),
                    'Specified Entities are deleted'
                ).to.be.true
                expect(schoolMemberships).to.equal(
                    0,
                    'Relations of specified Entities are CASCADE deleted'
                )
                expect(
                    [users, organizations].every((count) => count === 1),
                    'Unspecified Entities are preserved'
                ).to.be.true
            })
        })
    })
})
