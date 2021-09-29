import { expect, use } from 'chai'
import { Connection, EntityManager } from 'typeorm'

import { Subject } from '../../../src/entities/subject'
import { createTestConnection } from '../../utils/testConnection'
import { createOrganization } from '../../factories/organization.factory'
import { createSubject } from '../../factories/subject.factory'
import { Organization } from '../../../src/entities/organization'
import chaiAsPromised from 'chai-as-promised'
import { truncateTables } from '../../utils/database'

use(chaiAsPromised)

describe('Subject', () => {
    let connection: Connection
    let manager: EntityManager
    let subject: Subject
    let org: Organization

    before(async () => {
        connection = await createTestConnection()
        manager = connection.manager
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        org = createOrganization()
        subject = createSubject(org)
    })

    afterEach(async () => {
        await truncateTables(connection)
    })

    describe('.new', () => {
        context('when system is not defined', () => {
            beforeEach(async () => {
                subject.system = undefined
                await manager.save(org)
                await manager.save(subject)
            })

            it('creates the subject as not a system subject', async () => {
                const dbSubject = await Subject.findOneOrFail(subject.id)

                expect(dbSubject.id).to.eq(subject.id)
                expect(dbSubject.name).to.eq(subject.name)
                expect(dbSubject.system).to.be.false
            })
        })

        context('when name is not defined', () => {
            beforeEach(async () => {
                subject.name = undefined
                await manager.save(org)
            })

            it('raises an error', async () => {
                await expect(manager.save(subject)).to.be.rejected
            })
        })

        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(org)
                await manager.save(subject)
            })

            it('creates the subject', async () => {
                const dbSubject = await Subject.findOneOrFail(subject.id)

                expect(dbSubject.id).to.eq(subject.id)
                expect(dbSubject.name).to.eq(subject.name)
                expect(dbSubject.system).to.be.false
                const dbOrganization = await dbSubject.organization
                expect(dbOrganization?.organization_id).to.eq(
                    org.organization_id
                )
                expect(dbSubject.created_at).not.to.be.null
                expect(dbSubject.deleted_at).to.be.null
                expect(dbSubject.system).to.be.false
            })
        })
    })
})
