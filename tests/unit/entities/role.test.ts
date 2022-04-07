import { expect } from 'chai'
import { DataSource, EntityManager } from 'typeorm'

import { createTestConnection } from '../../utils/testConnection'
import { createRole } from '../../factories/role.factory'
import { Role } from '../../../src/entities/role'
import { truncateTables } from '../../utils/database'

describe('Role', () => {
    let dataSource: DataSource
    let manager: EntityManager
    let role: Role

    before(async () => {
        dataSource = await createTestConnection()
        manager = dataSource.manager
    })

    after(async () => {
        await dataSource?.close()
    })

    beforeEach(async () => {
        role = createRole()
    })

    afterEach(async () => {
        await truncateTables(dataSource)
    })

    describe('.new', () => {
        context('when system_role is not defined', () => {
            beforeEach(async () => {
                await manager.save(role)
            })

            it('creates the role as not a system role', async () => {
                const dbRole = await Role.findOneByOrFail({
                    role_id: role.role_id,
                })

                expect(dbRole.role_id).to.eq(role.role_id)
                expect(dbRole.role_name).to.eq(role.role_name)
                expect(dbRole.system_role).to.be.false
            })
        })

        context('when role description is undefined', () => {
            beforeEach(async () => {
                await manager.save(role)
            })

            it('creates the role with the default description', async () => {
                const dbRole = await Role.findOneByOrFail({
                    role_id: role.role_id,
                })

                expect(dbRole.role_id).to.eq(role.role_id)
                expect(dbRole.role_name).to.eq(role.role_name)
                expect(dbRole.role_description).to.eq('System Default Role')
            })
        })

        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(role)
            })

            it('creates the role', async () => {
                const dbRole = await Role.findOneByOrFail({
                    role_id: role.role_id,
                })

                expect(dbRole.role_id).to.eq(role.role_id)
                expect(dbRole.role_name).to.eq(role.role_name)
                expect(dbRole.role_description).to.eq(role.role_description)
                expect(dbRole.system_role).to.eq(role.system_role)
            })
        })
    })
})
