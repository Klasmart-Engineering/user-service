import { User } from '../../../src/entities/user'
import { Organization } from '../../../src/entities/organization'
import { getRepository, getConnection } from 'typeorm'
import { TestConnection } from '../../utils/testConnection'
import { ownersForOrgs } from '../../../src/loaders/organizationsConnection'
import { expect } from 'chai'
import { createUser } from '../../factories/user.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationOwnership } from '../../factories/organizationOwnership.factory'
import { OrganizationOwnership } from '../../../src/entities/organizationOwnership'

describe('organizationsConnection loaders', async () => {
    let connection: TestConnection

    const numberOfOrganizations = 5
    const numberOfUsers = 5
    let organizationsList: Organization[] = []
    let organizationIds: string[]
    let usersList: User[] = []
    let organizationOwnersList: OrganizationOwnership[] = []

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        organizationsList = []
        organizationsList = await connection.manager.save(
            Array(numberOfOrganizations).fill(undefined).map(createOrganization)
        )
        organizationsList.sort((a, b) =>
            a.organization_id > b.organization_id ? 1 : -1
        )
        organizationIds = organizationsList.map((org) => org.organization_id)

        usersList = []
        usersList = await connection.manager.save(
            Array(numberOfUsers).fill(undefined).map(createUser)
        )
        usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

        organizationOwnersList = []
        for (let i = 0; i < numberOfOrganizations; i++) {
            const ownership = createOrganizationOwnership({
                user: usersList[i],
                organization: organizationsList[i],
            })
            organizationOwnersList.push(ownership)
        }
        await connection.manager.save(organizationOwnersList)
    })

    context('ownersForOrgs', () => {
        it('returns an array with correct length to the organizationIds array', async () => {
            const orgOwners = await ownersForOrgs(organizationIds)
            expect(orgOwners.length).to.equal(organizationIds.length)
        })

        it('returns the expected data format', async () => {
            const orgOwners = await ownersForOrgs(organizationIds)

            await Promise.all(
                organizationIds.map(async (orgId, index) => {
                    const owners = orgOwners[index]
                    for (const owner of owners) {
                        const ownership = await getRepository(
                            OrganizationOwnership
                        ).findOneByOrFail({
                            user_id: usersList[index].user_id,
                            organization_id: orgId,
                        })
                        expect(owner.id).to.equal(ownership?.user_id)
                    }
                })
            )
        })

        it('makes the expected number of queries to the database', async () => {
            connection.logger.reset()
            await ownersForOrgs(organizationIds)
            expect(connection.logger.count).to.be.eq(1)
        })
    })
})
