import chai, { use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, EntityManager } from 'typeorm'

import { createTestConnection } from '../../utils/testConnection'
import { createSchool } from '../../factories/school.factory'
import { createOrganization } from '../../factories/organization.factory'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { Organization } from '../../../src/entities/organization'

chai.should()
use(chaiAsPromised)

describe('School', () => {
    let connection: Connection
    let manager: EntityManager
    let existingOrg: Organization
    let existingSchool: School

    before(async () => {
        connection = await createTestConnection()
        manager = connection.manager
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await connection.synchronize(true)
        existingOrg = createOrganization({})
        await manager.save(existingOrg)

        existingSchool = createSchool(existingOrg)
        await manager.save(existingSchool)
    })

    describe('create', () => {
        context('duplicate name outside the organization', () => {
            it('succeeds', async () => {
                const org = createOrganization({})
                await manager.save(org)

                const school = createSchool(org, existingSchool.school_name)

                return manager.save(school).should.be.fulfilled
            })
        })

        context('duplicate name inside the organization', () => {
            context('duplicate is active', () => {
                beforeEach(async () => {
                    existingSchool.status = Status.ACTIVE
                    await manager.save(existingSchool)
                })

                it('fails', async () => {
                    const school = createSchool(
                        await existingSchool.organization,
                        existingSchool.school_name
                    )

                    return manager.save(school).should.be.rejected
                })
            })
            context('duplicate is inactive', () => {
                beforeEach(async () => {
                    existingSchool.status = Status.INACTIVE
                    await manager.save(existingSchool)
                })

                context('new school is active', () => {
                    it('succeeds', async () => {
                        const school = createSchool(
                            await existingSchool.organization,
                            existingSchool.school_name
                        )

                        return manager.save(school).should.be.fulfilled
                    })
                })

                context('new school is inactive', () => {
                    it('succeeds', async () => {
                        const school = createSchool(
                            await existingSchool.organization,
                            existingSchool.school_name
                        )
                        school.status = Status.INACTIVE

                        return manager.save(school).should.be.fulfilled
                    })
                })
            })
        })
    })
})
