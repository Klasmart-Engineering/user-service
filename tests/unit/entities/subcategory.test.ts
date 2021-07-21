import { expect, use } from 'chai'
import { Connection, EntityManager } from 'typeorm'

import { Subcategory } from '../../../src/entities/subcategory'
import { createTestConnection } from '../../utils/testConnection'
import { createOrganization } from '../../factories/organization.factory'
import { createSubcategory } from '../../factories/subcategory.factory'
import { Organization } from '../../../src/entities/organization'
import chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

describe('Subcategory', () => {
    let connection: Connection
    let manager: EntityManager
    let subcategory: Subcategory
    let org: Organization

    before(async () => {
        connection = await createTestConnection()
        manager = connection.manager
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await connection.synchronize(true)
        org = createOrganization()
        subcategory = createSubcategory(org)
    })

    describe('.new', () => {
        context('when system is not defined', () => {
            beforeEach(async () => {
                subcategory.system = undefined
                await manager.save(org)
                await manager.save(subcategory)
            })

            it('creates the subcategory as not a system subcategory', async () => {
                const dbSubcategory = await Subcategory.findOneOrFail(
                    subcategory.id
                )

                expect(dbSubcategory.id).to.eq(subcategory.id)
                expect(dbSubcategory.name).to.eq(subcategory.name)
                expect(dbSubcategory.system).to.be.false
            })
        })

        context('when name is not defined', () => {
            beforeEach(async () => {
                subcategory.name = undefined
                await manager.save(org)
            })

            it('raises an error', async () => {
                const fn = () => manager.save(subcategory)

                await expect(fn()).to.be.rejected
            })
        })

        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(org)
                await manager.save(subcategory)
            })

            it('creates the subcategory', async () => {
                const dbSubcategory = await Subcategory.findOneOrFail(
                    subcategory.id
                )

                expect(dbSubcategory.id).to.eq(subcategory.id)
                expect(dbSubcategory.name).to.eq(subcategory.name)
                expect(dbSubcategory.system).to.be.false
                const dbOrganization = await dbSubcategory.organization
                expect(dbOrganization?.organization_id).to.eq(
                    org.organization_id
                )
                expect(dbSubcategory.created_at).not.to.be.null
                expect(dbSubcategory.deleted_at).to.be.null
                expect(dbSubcategory.system).to.be.false
            })
        })
    })
})
