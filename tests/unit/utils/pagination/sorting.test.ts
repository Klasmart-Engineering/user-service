import { createQueryBuilder, SelectQueryBuilder, Connection } from 'typeorm'
import { addOrderByClause } from '../../../../src/utils/pagination/sorting'
import { expect } from 'chai'
import { createTestConnection } from '../../../utils/testConnection'

describe('paginated sorting', () => {
    let scope: SelectQueryBuilder<any>
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        scope = createQueryBuilder('user')
    })

    it('automatically applies the table alias to the primaryKey', () => {
        addOrderByClause(scope, 'FORWARD', {
            primaryKey: 'user_id',
        })
        const sql = scope.getSql()
        expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
            'ORDER BY "User"."user_id" ASC NULLS LAST'
        )
    })
    context('pagination direction', () => {
        it('orders ascending when paginating forwards with defaults', () => {
            addOrderByClause(scope, 'FORWARD', {
                primaryKey: 'user_id',
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."user_id" ASC NULLS LAST'
            )
        })
        it('orders descending when paginating backwards with defaults', () => {
            addOrderByClause(scope, 'BACKWARD', {
                primaryKey: 'user_id',
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."user_id" DESC NULLS LAST'
            )
        })
    })

    context('multiple column sorting', () => {
        it('sorts by the primaryKey last', () => {
            addOrderByClause(scope, 'FORWARD', {
                primaryKey: 'user_id',
                sort: {
                    field: 'given_name',
                    order: 'ASC',
                },
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."given_name" ASC NULLS LAST, "User"."user_id" ASC NULLS LAST'
            )
        })
        it('uses the same ordering for each column', () => {
            addOrderByClause(scope, 'BACKWARD', {
                primaryKey: 'user_id',
                sort: {
                    field: 'given_name',
                    order: 'ASC',
                },
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."given_name" DESC NULLS LAST, "User"."user_id" DESC NULLS LAST'
            )
        })
    })
    context('aliasing', () => {
        it('maps fields to aliases', () => {
            addOrderByClause(scope, 'FORWARD', {
                primaryKey: 'user_id',
                sort: {
                    field: 'givenName',
                    order: 'ASC',
                },
                aliases: {
                    givenName: 'given_name',
                },
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."given_name" ASC NULLS LAST, "User"."user_id" ASC NULLS LAST'
            )
        })
        it('parses table names included in aliases', () => {
            addOrderByClause(scope, 'FORWARD', {
                primaryKey: 'user_id',
                sort: {
                    field: 'givenName',
                    order: 'ASC',
                },
                aliases: {
                    givenName: 'given_name',
                },
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."given_name" ASC NULLS LAST, "User"."user_id" ASC NULLS LAST'
            )
        })
    })

    context('sorting order', () => {
        it('uses the specified order when paginating forwards', () => {
            addOrderByClause(scope, 'FORWARD', {
                primaryKey: 'user_id',
                sort: {
                    field: 'givenName',
                    order: 'DESC',
                },
                aliases: {
                    givenName: 'given_name',
                },
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."given_name" DESC NULLS LAST, "User"."user_id" DESC NULLS LAST'
            )
        })
        it('reverses the specified order when paginating backwards', () => {
            addOrderByClause(scope, 'BACKWARD', {
                primaryKey: 'user_id',
                sort: {
                    field: 'givenName',
                    order: 'DESC',
                },
                aliases: {
                    givenName: 'given_name',
                },
            })
            const sql = scope.getSql()
            expect(sql.slice(sql.indexOf('ORDER BY'))).to.eq(
                'ORDER BY "User"."given_name" ASC NULLS LAST, "User"."user_id" ASC NULLS LAST'
            )
        })
    })
})
