import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, EntityManager } from 'typeorm'

import { createTestConnection } from '../../utils/testConnection'
import { createSchool } from '../../factories/school.factory'
import { createOrganization } from '../../factories/organization.factory'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { Organization } from '../../../src/entities/organization'
import { createUser } from '../../factories/user.factory'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { createClass } from '../../factories/class.factory'

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
        existingOrg = createOrganization()
        await manager.save(existingOrg)

        existingSchool = createSchool(existingOrg)
        await manager.save(existingSchool)
    })

    describe('create', () => {
        context('duplicate name outside the organization', () => {
            it('succeeds', async () => {
                const org = createOrganization()
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

    describe('inactivate', () => {
        it('sets the status to inactive and populates deleted_at', async () => {
            await existingSchool.inactivate(manager)

            expect(existingSchool.status).to.equal(Status.INACTIVE)
            expect(existingSchool.deleted_at).to.not.be.null
        })

        it('inactivates all memberships', async () => {
            for (let i = 0; i < 2; i++) {
                const user = await manager.save(createUser())
                const membership = new SchoolMembership()
                membership.school_id = existingSchool.school_id
                membership.school = Promise.resolve(existingSchool)
                membership.user_id = user.user_id
                membership.user = Promise.resolve(user)
                await manager.save(membership)
            }

            await existingSchool.inactivate(manager)

            const memberships = (await existingSchool.memberships) || []

            expect(memberships.length).to.equal(2)
            memberships?.forEach((membership) => {
                expect(membership.status).to.equal(Status.INACTIVE)
                expect(membership.deleted_at).to.not.be.null
            })
        })

        it("doesn't inactivate linked classes", async () => {
            // UD-572
            const cls = await createClass([existingSchool]).save()

            await existingSchool.inactivate(manager)

            cls.reload()

            expect(cls.status).to.equal(Status.ACTIVE)
            expect(cls.deleted_at).to.be.null
            expect(await cls.schools).to.include(existingSchool)
        })
    })
})
