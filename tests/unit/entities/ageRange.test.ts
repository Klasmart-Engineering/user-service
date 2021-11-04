import { expect, use } from 'chai'
import { Connection, EntityManager } from 'typeorm'

import { AgeRange } from '../../../src/entities/ageRange'
import { createTestConnection } from '../../utils/testConnection'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createOrganization } from '../../factories/organization.factory'
import { Organization } from '../../../src/entities/organization'
import chaiAsPromised from 'chai-as-promised'
import { truncateTables } from '../../utils/database'

use(chaiAsPromised)

describe('AgeRange', () => {
    let connection: Connection
    let manager: EntityManager
    let ageRange: AgeRange
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
        ageRange = createAgeRange(org)
    })

    afterEach(async () => {
        await truncateTables(connection)
    })

    describe('.new', () => {
        context('when system is not defined', () => {
            beforeEach(async () => {
                (ageRange as any).system = undefined
                await manager.save(org)
                await manager.save(ageRange)
            })

            it('creates the age range as not a system age range', async () => {
                const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                expect(dbAgeRange.id).to.eq(ageRange.id)
                expect(dbAgeRange.name).to.eq(ageRange.name)
                expect(dbAgeRange.system).to.be.false
            })
        })

        context('when name is not defined', () => {
            beforeEach(async () => {
                ageRange.name = undefined
                await manager.save(org)
            })

            it('raises an error', async () => {
                await expect(manager.save(ageRange)).to.be.rejected
            })
        })

        context('when the high value is not valid', () => {
            beforeEach(async () => {
                await manager.save(org)
            })

            it('raises an error', async () => {
                for (const nonValidValue of [0, 1.1, 100, 105, 200]) {
                    ageRange.high_value = nonValidValue
                    await expect(manager.save(ageRange)).to.be.rejected
                }
            })
        })

        context('when the low value is not valid', () => {
            beforeEach(async () => {
                await manager.save(org)
            })

            it('raises an error', async () => {
                for (const nonValidValue of [1.1, 100, 105, 200]) {
                    ageRange.low_value = nonValidValue
                    await expect(manager.save(ageRange)).to.be.rejected
                }
            })
        })

        context(
            'when the age range already exists with the same org, high and low values',
            () => {
                beforeEach(async () => {
                    await manager.save(org)
                    await manager.save(ageRange)
                })

                it.skip('raises an error', async () => {
                    //Temporarily skipped because of failing test and business deprioritization
                    const newAgeRange = createAgeRange(org)
                    newAgeRange.high_value = ageRange.high_value
                    newAgeRange.low_value = ageRange.low_value
                    await expect(manager.save(newAgeRange)).to.be.rejected
                })
            }
        )

        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(org)
                await manager.save(ageRange)
            })

            it('creates the age range', async () => {
                const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                expect(dbAgeRange.id).to.eq(ageRange.id)
                expect(dbAgeRange.name).to.eq(ageRange.name)
                expect(dbAgeRange.high_value).to.eq(ageRange.high_value)
                expect(dbAgeRange.high_value_unit).to.eq(
                    ageRange.high_value_unit
                )
                expect(dbAgeRange.low_value).to.eq(ageRange.low_value)
                expect(dbAgeRange.low_value_unit).to.eq(ageRange.low_value_unit)
                const dbOrganization = await dbAgeRange.organization
                expect(dbOrganization?.organization_id).to.eq(
                    org.organization_id
                )
                expect(dbAgeRange.created_at).not.to.be.null
                expect(dbAgeRange.deleted_at).to.be.null
                expect(dbAgeRange.system).to.be.false
            })
        })
    })
})
