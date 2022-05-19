import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { User } from '../../../../src/entities/user'
import { createUsers } from '../../../factories/user.factory'
import {
    getMap,
    OrganizationMembershipMap,
    SchoolMembershipMap,
} from '../../../../src/utils/resolvers/entityMaps'
import { TestConnection } from '../../../utils/testConnection'
import {
    compareMultipleEntities,
    compareEntities,
} from '../../../utils/assertions'
import { School } from '../../../../src/entities/school'
import { createSchools } from '../../../factories/school.factory'
import { Organization } from '../../../../src/entities/organization'
import {
    createOrganization,
    createOrganizations,
} from '../../../factories/organization.factory'
import { OrganizationMembership } from '../../../../src/entities/organizationMembership'
import {
    createOrganizationMembership,
    createOrgMembershipsInManyOrgs,
} from '../../../factories/organizationMembership.factory'
import { SchoolMembership } from '../../../../src/entities/schoolMembership'
import { createSchoolMembershipsInManySchools } from '../../../factories/schoolMembership.factory'
import { getConnection } from 'typeorm'
import { Status } from '../../../../src/entities/status'
import { OrganizationMembershipKey } from '../../../../src/utils/resolvers/user'

use(chaiAsPromised)

describe('entityMaps', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    context('#idToEntityMap', () => {
        let users: User[]
        beforeEach(async () => {
            const userIds = (await User.save(createUsers(5))).map(
                (u) => u.user_id
            )
            users = await User.findByIds(userIds)
        })

        it('creates a map with all expected values', async () => {
            const userMap = await getMap.user(users.map((u) => u.user_id))
            expect(userMap.size).to.equal(users.length)
            users.forEach((u) => {
                const userFromMap = userMap.get(u.user_id)
                expect(userFromMap).to.not.be.undefined
                if (userFromMap) compareEntities(userFromMap, u)
            })
        })

        context('when retrieving a property from a related table', () => {
            let membership: OrganizationMembership
            let organization: Organization
            let userInOrg: User
            let map: Map<string, User>
            beforeEach(async () => {
                userInOrg = users[0]
                organization = await createOrganization().save()
                const membershipId: OrganizationMembershipKey = OrganizationMembership.getId(
                    await createOrganizationMembership({
                        user: userInOrg,
                        organization,
                    }).save()
                )
                membership = await OrganizationMembership.findOneByOrFail({
                    user_id: membershipId.userId,
                    organization_id: membershipId.organizationId,
                })
                map = await getMap.user(
                    users.map((u) => u.user_id),
                    ['memberships']
                )
            })

            it('retrieves the expected values', async () => {
                for (const user of users) {
                    const userFromMap = map.get(user.user_id)
                    // eslint-disable-next-line no-await-in-loop
                    const membershipsFromMap = await userFromMap?.memberships
                    expect(membershipsFromMap).to.not.be.undefined
                    if (membershipsFromMap === undefined) continue

                    if (user.user_id === userInOrg.user_id) {
                        compareMultipleEntities(membershipsFromMap, [
                            membership,
                        ])
                    } else {
                        expect(membershipsFromMap).to.be.empty
                    }
                }
            })

            it('does not need an extra query to retrieve the property', async () => {
                const userFromMap = map.get(userInOrg.user_id)
                expect(userFromMap).to.not.be.undefined
                if (!userFromMap) return
                connection.logger.reset()
                await userFromMap.memberships
                expect(connection.logger.count).to.equal(0)
            })
        })
    })

    describe('#getMap.membership', () => {
        context('.organization', () => {
            let memberships: OrganizationMembership[]
            let orgs: Organization[]
            let users: User[]
            beforeEach(async () => {
                orgs = await Organization.save(createOrganizations(2))
                users = await User.save(createUsers(5))
                const membershipIds = (
                    await OrganizationMembership.save(
                        createOrgMembershipsInManyOrgs(users, orgs)
                    )
                ).map((om) => OrganizationMembership.getId(om))
                memberships = await OrganizationMembership.findByIds(
                    membershipIds
                )
            })

            it('creates a map with all expected values', async () => {
                const membershipMap = await getMap.membership.organization(
                    orgs.map((o) => o.organization_id),
                    users.map((u) => u.user_id)
                )
                expect(membershipMap.size).to.equal(memberships.length)
                memberships.forEach((m) => {
                    const membershipFromMap = membershipMap.get({
                        organizationId: m.organization_id,
                        userId: m.user_id,
                    })
                    expect(membershipFromMap).to.not.be.undefined
                    if (membershipFromMap) compareEntities(membershipFromMap, m)
                })
            })

            it('filters memberships by statuses', async () => {
                memberships[0].status = Status.DELETED
                await memberships[0].save()
                memberships[1].status = Status.INACTIVE
                await memberships[1].save()
                const membershipMap = await getMap.membership.organization(
                    orgs.map((o) => o.organization_id),
                    users.map((u) => u.user_id),
                    undefined,
                    [Status.ACTIVE, Status.INACTIVE]
                )
                // -1 because one membership has the status of deleted
                expect(membershipMap.size).to.equal(memberships.length - 1)
                memberships.slice(1).forEach((m) => {
                    const membershipFromMap = membershipMap.get({
                        organizationId: m.organization_id,
                        userId: m.user_id,
                    })
                    expect(membershipFromMap).to.not.be.undefined
                    if (membershipFromMap) compareEntities(membershipFromMap, m)
                })
            })

            context('when retrieving a property from a related table', () => {
                let map: OrganizationMembershipMap
                beforeEach(async () => {
                    map = await getMap.membership.organization(
                        orgs.map((o) => o.organization_id),
                        users.map((u) => u.user_id),
                        ['organization']
                    )
                })

                it('retrieves the expected values', async () => {
                    const orgsFromDb = await Organization.findByIds(
                        orgs.map((o) => o.organization_id)
                    )
                    const orgsFromDbMap = new Map(
                        orgsFromDb.map((o) => [o.organization_id, o])
                    )
                    for (const membership of memberships) {
                        const membershipFromMap = map.get({
                            organizationId: membership.organization_id,
                            userId: membership.user_id,
                        })
                        // eslint-disable-next-line no-await-in-loop
                        const orgFromMap = await membershipFromMap?.organization
                        const orgFromDb = orgsFromDbMap.get(
                            membership.organization_id
                        )
                        expect(orgFromMap).to.not.be.undefined
                        expect(orgFromDb).to.not.be.undefined
                        if (!orgFromMap || !orgFromDb) return
                        compareEntities(orgFromMap, orgFromDb)
                    }
                })

                it('does not need an extra query to retrieve the property', async () => {
                    const membershipFromMap = map.get({
                        organizationId: memberships[0].organization_id,
                        userId: memberships[0].user_id,
                    })
                    expect(membershipFromMap).to.not.be.undefined
                    if (!membershipFromMap) return
                    connection.logger.reset()
                    await membershipFromMap.organization
                    expect(connection.logger.count).to.equal(0)
                })
            })
        })

        context('.school', () => {
            let memberships: SchoolMembership[]
            let schools: School[]
            let users: User[]
            beforeEach(async () => {
                const schoolIds = (await School.save(createSchools(2))).map(
                    (s) => s.school_id
                )
                schools = await School.findByIds(schoolIds) // this prevents discrepancies when comparing `schools` to `schoolFromMap` later on
                users = await User.save(createUsers(5))
                const membershipIds = (
                    await SchoolMembership.save(
                        createSchoolMembershipsInManySchools(users, schools)
                    )
                ).map((om) => SchoolMembership.getId(om))
                memberships = await SchoolMembership.findByIds(membershipIds)
            })

            it('creates a map with all expected values', async () => {
                const membershipMap = await getMap.membership.school(
                    schools.map((s) => s.school_id),
                    users.map((u) => u.user_id)
                )
                expect(membershipMap.size).to.equal(memberships.length)
                memberships.forEach((m) => {
                    const membershipFromMap = membershipMap.get({
                        schoolId: m.school_id,
                        userId: m.user_id,
                    })
                    expect(membershipFromMap).to.not.be.undefined
                    if (membershipFromMap) compareEntities(membershipFromMap, m)
                })
            })

            context('when retrieving a property from a related table', () => {
                let map: SchoolMembershipMap
                beforeEach(async () => {
                    map = await getMap.membership.school(
                        schools.map((s) => s.school_id),
                        users.map((u) => u.user_id),
                        ['school']
                    )
                })

                it('retrieves the expected values', async () => {
                    const schoolsFromDb = await School.findByIds(
                        schools.map((s) => s.school_id)
                    )
                    const schoolsFromDbMap = new Map(
                        schoolsFromDb.map((s) => [s.school_id, s])
                    )
                    for (const membership of memberships) {
                        const membershipFromMap = map.get({
                            schoolId: membership.school_id,
                            userId: membership.user_id,
                        })
                        // eslint-disable-next-line no-await-in-loop
                        const schoolFromMap = await membershipFromMap?.school
                        const schoolFromDb = schoolsFromDbMap.get(
                            membership.school_id
                        )
                        expect(schoolFromMap).to.not.be.undefined
                        expect(schoolFromDb).to.not.be.undefined
                        if (!schoolFromMap || !schoolFromDb) return
                        compareEntities(schoolFromMap, schoolFromDb)
                    }
                })

                it('does not need an extra query to retrieve the property', async () => {
                    const membershipFromMap = map.get({
                        schoolId: memberships[0].school_id,
                        userId: memberships[0].user_id,
                    })
                    expect(membershipFromMap).to.not.be.undefined
                    if (!membershipFromMap) return
                    connection.logger.reset()
                    await membershipFromMap.school
                    expect(connection.logger.count).to.equal(0)
                })
            })
        })
    })
})
