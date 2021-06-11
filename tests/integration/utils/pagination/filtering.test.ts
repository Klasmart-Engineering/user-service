import chaiAsPromised from 'chai-as-promised'
import { Connection, getRepository, SelectQueryBuilder } from 'typeorm'
import { expect, use } from 'chai'
import { createTestConnection } from '../../../utils/testConnection'
import { User } from '../../../../src/entities/user'
import {
    IEntityFilter,
    getWhereClauseFromFilter,
} from '../../../../src/utils/pagination/filtering'

use(chaiAsPromised)

// don't use faker, as we need this to be deterministic for these tests
function getUsers() {
    const userData = [
        {
            user_id: '07d15ab3-67e2-4933-b933-3d3a3d40887f',
            given_name: 'John',
            family_name: 'Smith',
            email: 'john@gmail.com',
            username: 'john',
            date_of_birth: '01-1993',
            gender: 'male',
            primary: true,
            deleted_at: new Date(2020, 0, 1),
        },
        {
            user_id: '122e3d10-43ed-4bac-8d7a-f0d6fde115b9',
            given_name: 'Sally',
            family_name: 'Smith',
            email: 'sally@gmail.com',
            username: 'sally',
            date_of_birth: '01-2000',
            gender: 'female',
            primary: false,
            deleted_at: new Date(2000, 0, 1),
        },
    ]

    const users: User[] = []
    for (const u of userData) {
        const user = new User()
        user.user_id = u.user_id
        user.given_name = u.given_name
        user.family_name = u.family_name
        user.email = u.email
        user.username = u.username
        user.date_of_birth = u.date_of_birth
        user.gender = u.gender
        user.primary = u.primary
        user.deleted_at = u.deleted_at
        users.push(user)
    }

    return users
}

describe('filtering', () => {
    let connection: Connection
    let scope: SelectQueryBuilder<any>

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await connection.manager.save(getUsers())
        scope = getRepository(User).createQueryBuilder()
    })

    context('strings', () => {
        it('supports string.eq', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'eq',
                    value: 'john@gmail.com',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports string.neq', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'neq',
                    value: 'john@gmail.com',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports string.contains', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'contains',
                    value: 'john',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports case-insensitive string.contains', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'contains',
                    value: 'JOHN',
                    caseInsensitive: true,
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('ignores contains filters with empty values', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'contains',
                    value: '',
                },
            }
            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(2)
        })
    })

    context('booleans', () => {
        it('supports boolean.eq', async () => {
            const filter: IEntityFilter = {
                primary: {
                    operator: 'eq',
                    value: true,
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
    })

    context('dates', () => {
        it('supports date.eq', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'eq',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.neq', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'neq',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.gt', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'gt',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.gte', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'gte',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(2)
        })
        it('supports date.lt', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'lt',
                    value: '2020-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.lte', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'lte',
                    value: '2020-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(2)
        })
    })

    context('uuids', () => {
        it('supports uuid.eq', async () => {
            const filter: IEntityFilter = {
                userId: {
                    operator: 'eq',
                    value: '07d15ab3-67e2-4933-b933-3d3a3d40887f',
                },
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    userId: ["concat(User.user_id, '')"],
                })
            )
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports uuid.neq', async () => {
            const filter: IEntityFilter = {
                userId: {
                    operator: 'neq',
                    value: '07d15ab3-67e2-4933-b933-3d3a3d40887f',
                },
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    userId: ["concat(User.user_id, '')"],
                })
            )
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports uuid.contains', async () => {
            const filter: IEntityFilter = {
                userId: {
                    operator: 'contains',
                    value: '07d15ab3',
                },
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    userId: ["concat(User.user_id, '')"],
                })
            )
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
    })
})
