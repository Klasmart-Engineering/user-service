import { expect } from 'chai'
import { Connection, EntityManager } from 'typeorm'

import { createTestConnection } from '../../utils/testConnection'
import { createUser } from '../../factories/user.factory'
import { User } from '../../../src/entities/user'

describe('User', () => {
    let connection: Connection
    let manager: EntityManager
    let user: User

    before(async () => {
        connection = await createTestConnection()
        manager = connection.manager
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await connection.synchronize(true)
        user = createUser()
    })

    describe('.new', () => {
        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(user)
            })

            it('creates the OrganizationOwnership', async () => {
                const dbUser = await User.findOneOrFail({
                    where: {
                        user_id: user.user_id,
                    },
                })

                expect(dbUser.user_id).to.eq(user.user_id)
                expect(dbUser.given_name).to.eq(user.given_name)
                expect(dbUser.family_name).to.eq(user.family_name)
                expect(dbUser.full_name()).to.eq(
                    `${user.given_name} ${user.family_name}`
                )
                expect(dbUser.email).to.eq(user.email)
                expect(dbUser.username).to.eq(user.username)
            })
        })
    })
})
