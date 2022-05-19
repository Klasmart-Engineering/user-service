import { expect, use } from 'chai'
import { Connection, EntityManager } from 'typeorm'

import { createTestConnection } from '../../utils/testConnection'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Status } from '../../../src/entities/status'
import chaiAsPromised from 'chai-as-promised'
import { truncateTables } from '../../utils/database'

use(chaiAsPromised)

describe('Grade', () => {
    let connection: Connection
    let manager: EntityManager
    let progressFromGrade: Grade
    let progressToGrade: Grade
    let grade: Grade
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
        progressFromGrade = createGrade(org)
        progressToGrade = createGrade(org)
        grade = createGrade(org, progressFromGrade, progressToGrade)
    })

    afterEach(async () => {
        await truncateTables(connection)
    })

    describe('.new', () => {
        context('when system is not defined', () => {
            beforeEach(async () => {
                grade.system = undefined
                await manager.save(org)
                await manager.save(progressFromGrade)
                await manager.save(progressToGrade)
                await manager.save(grade)
            })

            it('creates the grade as not a system age grade', async () => {
                const dbGrade = await Grade.findOneByOrFail({ id: grade.id })

                expect(dbGrade.id).to.eq(dbGrade.id)
                expect(dbGrade.name).to.eq(dbGrade.name)
                expect(dbGrade.system).to.be.false
            })
        })

        context('when name is not defined', () => {
            beforeEach(async () => {
                grade.name = undefined
                await manager.save(org)
                await manager.save(progressFromGrade)
                await manager.save(progressToGrade)
            })

            it('raises an error', async () => {
                await expect(manager.save(grade)).to.be.rejected
            })
        })

        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(org)
                await manager.save(progressFromGrade)
                await manager.save(progressToGrade)
                await manager.save(grade)
            })

            it('creates the grade', async () => {
                const dbGrade = await Grade.findOneByOrFail({ id: grade.id })

                expect(dbGrade.id).to.eq(dbGrade.id)
                expect(dbGrade.name).to.eq(dbGrade.name)
                expect(dbGrade.status).to.eq(Status.ACTIVE)
                expect(dbGrade.created_at).not.to.be.null
                expect(dbGrade.deleted_at).to.be.null
                expect(dbGrade.system).to.be.false
                const dbOrganization = await dbGrade.organization
                expect(dbOrganization?.organization_id).to.eq(
                    org.organization_id
                )
                const dbProgressFromGrade = await dbGrade.progress_from_grade
                expect(dbProgressFromGrade?.id).to.eq(progressFromGrade.id)
                const dbProgressToGrade = await dbGrade.progress_to_grade
                expect(dbProgressToGrade?.id).to.eq(progressToGrade.id)
            })
        })
    })
})
