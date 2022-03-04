import { expect } from 'chai'
import { getRepository } from 'typeorm'
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder'
import { User } from '../../../src/entities/user'
import { usersConnectionQuery } from '../../../src/pagination/usersConnection'
import { createClass } from '../../factories/class.factory'
import { createUser } from '../../factories/user.factory'

describe('usersConnection', () => {
    context('usersConnectionQuery', () => {
        let scope: SelectQueryBuilder<User>
        let expectedUser: User

        beforeEach(async () => {
            expectedUser = await createUser().save()
            await createUser().save()
            scope = getRepository(User).createQueryBuilder()
        })

        it('can filter by username', async () => {
            await usersConnectionQuery(scope, {
                username: { operator: 'eq', value: expectedUser.username },
            })
            const users = await scope.getMany()
            expect(users).to.have.length(1)
            expect(users[0].user_id).to.eq(expectedUser.user_id)
        })

        it('can filter by class ID', async () => {
            const class_ = await createClass(undefined, undefined, {
                students: [expectedUser],
            }).save()

            await usersConnectionQuery(scope, {
                classId: { operator: 'eq', value: class_.class_id },
            })
            const users = await scope.getMany()
            expect(users).to.have.length(1)
            expect(users[0].user_id).to.eq(expectedUser.user_id)
        })
    })
})
