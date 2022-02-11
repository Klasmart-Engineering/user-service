import { Organization } from '../../../src/entities/organization'
import { School } from '../../../src/entities/school'
import { createOrganization } from '../../factories/organization.factory'
import { createSchool } from '../../factories/school.factory'
import {
    organizationsForSchools,
    schoolsByIds,
} from '../../../src/loaders/school'
import { expect } from 'chai'

describe('School Dataloaders', () => {
    const numSchools = 5
    let orgs: Organization[]
    let schools: School[]

    beforeEach(async () => {
        orgs = await Organization.save(
            Array.from(Array(numSchools), createOrganization)
        )
        schools = await School.save(
            Array.from(Array(numSchools), (v: unknown, i: number) =>
                createSchool(orgs[i])
            )
        )
    })
    describe('#organizationsForSchools', () => {
        let returnedOrgs: (Organization | undefined)[]
        beforeEach(async () => {
            returnedOrgs = await organizationsForSchools(
                schools.map((s) => s.school_id)
            )
        })
        it('always returns an array of equal length', async () => {
            expect(returnedOrgs.length).to.eq(orgs.length)
        })
        it('returns all schools for the requested memberships in order', async () => {
            for (let i = 0; i < numSchools; i++) {
                const expectedOrg = await schools[i].organization
                const returnedOrg = returnedOrgs[i]
                expect(returnedOrg?.organization_id).to.eq(
                    expectedOrg?.organization_id
                )
            }
        })
    })
    describe('#schoolsForSchoolMemberships', () => {
        let returnedSchools: (School | undefined)[]
        beforeEach(async () => {
            returnedSchools = await schoolsByIds(
                schools.map((s) => s.school_id)
            )
        })
        it('always returns an array of equal length', async () => {
            expect(returnedSchools.length).to.eq(schools.length)
        })
        it('returns all schools for the requested memberships in order', async () => {
            for (let i = 0; i < schools.length; i++) {
                expect(schools[i].school_id).to.eq(
                    returnedSchools[i]?.school_id
                )
            }
        })
    })
})
