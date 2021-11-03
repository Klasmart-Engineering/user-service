import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, EntityManager } from 'typeorm'
import { QueryFailedError } from 'typeorm'

import { createTestConnection } from '../../utils/testConnection'
import { createUser } from '../../factories/user.factory'
import { createOrganization } from '../../factories/organization.factory'
import { Organization } from '../../../src/entities/organization'
import { OrganizationOwnership } from '../../../src/entities/organizationOwnership'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { truncateTables } from '../../utils/database'

use(chaiAsPromised)

describe('OrganizationOwnership', () => {
    let connection: Connection
    let manager: EntityManager
    let user: User
    let organization: Organization

    before(async () => {
        connection = await createTestConnection()
        manager = connection.manager
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        user = createUser()
        organization = createOrganization(user)
    })

    afterEach(async () => {
        await truncateTables(connection)
    })

    describe('.new', () => {
        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(user)
                await manager.save(organization)
            })

            it('creates the OrganizationOwnership', async () => {
                const ownership = new OrganizationOwnership()
                ownership.user_id = user.user_id
                ownership.organization_id = organization.organization_id
                await manager.save(ownership)

                const dbOwnership = await OrganizationOwnership.findOneOrFail({
                    where: {
                        organization_id: organization.organization_id,
                        user_id: user.user_id,
                    },
                })

                const dbUser = await dbOwnership.user
                expect(dbUser.user_id).to.eq(user.user_id)
                const dbOrganization = await dbOwnership.organization
                expect(dbOrganization.organization_id).to.eq(
                    organization.organization_id
                )
                expect(dbOwnership.status).to.eq(Status.ACTIVE)
                expect(dbOwnership.deleted_at).to.be.null
            })
        })

        context('when the organization does not exists', () => {
            beforeEach(async () => {
                await manager.save(user)
            })

            it('does not create the OrganizationOwnership', async () => {
                const ownership = new OrganizationOwnership()
                ownership.user_id = user.user_id
                ownership.organization_id = organization.organization_id

                await expect(
                    manager.save(ownership)
                ).to.eventually.be.rejectedWith(QueryFailedError)

                const dbOwnerships = await OrganizationOwnership.find({
                    where: { user_id: user.user_id },
                })
                expect(dbOwnerships).to.be.empty
            })
        })

        context('when the user does not exists', () => {
            beforeEach(async () => {
                await manager.save(organization)
            })

            it('does not create the OrganizationOwnership', async () => {
                const ownership = new OrganizationOwnership()
                ownership.user_id = user.user_id
                ownership.organization_id = organization.organization_id

                await expect(
                    manager.save(ownership)
                ).to.eventually.be.rejectedWith(QueryFailedError)

                const dbOwnerships = await OrganizationOwnership.find({
                    where: { organization_id: organization.organization_id },
                })
                expect(dbOwnerships).to.be.empty
            })
        })
    })

    describe('#inactivate', () => {
        let ownership: OrganizationOwnership

        context('when the organization ownership is active', () => {
            beforeEach(async () => {
                await manager.save(user)
                await manager.save(organization)

                ownership = new OrganizationOwnership()
                ownership.user_id = user.user_id
                ownership.organization_id = organization.organization_id
                await manager.save(ownership)
            })

            it('inactivates the ownership', async () => {
                await ownership.inactivate(manager)

                expect(ownership.status).to.eq(Status.INACTIVE)
                expect(ownership.deleted_at).not.to.be.null
            })
        })

        context('when the organization ownership is inactive', () => {
            beforeEach(async () => {
                await manager.save(user)
                await manager.save(organization)

                ownership = new OrganizationOwnership()
                ownership.user_id = user.user_id
                ownership.organization_id = organization.organization_id
                await manager.save(ownership)
                await ownership.inactivate(manager)
            })

            it('inactivates the ownership', async () => {
                const deletedAt = ownership.deleted_at
                await ownership.inactivate(manager)

                expect(ownership.status).to.eq(Status.INACTIVE)
                expect(ownership.deleted_at).to.eq(deletedAt)
            })
        })
    })
})
