import { expect } from 'chai'
import { Connection, EntityManager } from 'typeorm'

import { createTestConnection } from '../../utils/testConnection'
import { createUser } from '../../factories/user.factory'
import { User } from '../../../src/entities/user'
import { validateUser } from '../../../src/entities/validations/user'
import { CSVError } from '../../../src/types/csv/csvError'
import { addCsvError } from '../../../src/utils/csv/csvUtils'
import { getCustomConstraintDetails } from '../../../src/utils/joiMessages'
import validationConstants from '../../../src/utils/csv/validationConstants'

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

    describe('validations', () => {
        const fileErrors: CSVError[] = []
        const rowNumber = 0
        it('works', async () => {
            try {
                const user = new User()
                user.phone = '123'
                user.given_name = 'a'.repeat(
                    validationConstants.USER_GIVEN_NAME_MAX_LENGTH + 1
                )
                user.email = 'abc'
                user.gender = 'abc'

                const result = await validateUser(user)
                console.log('validation result', result)

                for (const x of result?.details || []) {
                    console.log(x.context)
                    const prop = x.context?.key
                    const details = getCustomConstraintDetails(x)
                    addCsvError(
                        fileErrors,
                        details?.code,
                        rowNumber,
                        `user_${prop}`,
                        details?.message,
                        {
                            entity: 'user',
                            attribute: prop,
                            ...x.context,
                            ...details?.params,
                        }
                    )
                }
                console.log(fileErrors)
            } catch (e) {
                console.log('validation error ', e)
            }
        })
    })
})
