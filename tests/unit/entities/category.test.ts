import { expect, use } from 'chai'
import { Connection, EntityManager } from 'typeorm'

import { Category } from '../../../src/entities/category'
import { createTestConnection } from '../../utils/testConnection'
import { createOrganization } from '../../factories/organization.factory'
import { createCategory } from '../../factories/category.factory'
import { Organization } from '../../../src/entities/organization'
import chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

describe('Category', () => {
    let connection: Connection
    let manager: EntityManager
    let category: Category
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
        category = createCategory(org)
    })

    describe('.new', () => {
        context('when system is not defined', () => {
            beforeEach(async () => {
                category.system = undefined
                await manager.save(org)
                await manager.save(category)
            })

            it('creates the category as not a system category', async () => {
                const dbCategory = await Category.findOneOrFail(category.id)

                expect(dbCategory.id).to.eq(category.id)
                expect(dbCategory.name).to.eq(category.name)
                expect(dbCategory.system).to.be.false
            })
        })

        context('when name is not defined', () => {
            beforeEach(async () => {
                category.name = undefined
                await manager.save(org)
            })

            it('raises an error', async () => {
                await expect(manager.save(category)).to.be.rejected
            })
        })

        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(org)
                await manager.save(category)
            })

            it('creates the category', async () => {
                const dbCategory = await Category.findOneOrFail(category.id)

                expect(dbCategory.id).to.eq(category.id)
                expect(dbCategory.name).to.eq(category.name)
                expect(dbCategory.system).to.be.false
                const dbOrganization = await dbCategory.organization
                expect(dbOrganization?.organization_id).to.eq(
                    org.organization_id
                )
                expect(dbCategory.created_at).not.to.be.null
                expect(dbCategory.deleted_at).to.be.null
                expect(dbCategory.system).to.be.false
            })
        })
    })
})
