import { expect } from 'chai'
import { Connection, SelectQueryBuilder } from 'typeorm'
import { School } from '../../../src/entities/school'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { User } from '../../../src/entities/user'
import { scopeHasJoin } from '../../../src/utils/typeorm'
import { createTestConnection } from '../../utils/testConnection'

context('typeorm', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('scopeHasJoin', () => {
        let baseScope: SelectQueryBuilder<User>

        beforeEach(() => {
            baseScope = User.createQueryBuilder()
        })

        it('if no joins, returns false', () => {
            expect(scopeHasJoin(baseScope, SchoolMembership)).to.be.false
        })

        it('if joined using the Entity class matching the target returns true', () => {
            expect(
                scopeHasJoin(
                    baseScope.innerJoin(SchoolMembership, 'memberships'),
                    SchoolMembership
                )
            ).to.be.true
        })

        it('if joined using the Entity relation name matching the target returns true', () => {
            expect(
                scopeHasJoin(
                    baseScope.innerJoin(
                        'User.school_memberships',
                        'memberships'
                    ),
                    SchoolMembership
                )
            ).to.be.true
        })
        it('if one of many joins returns true', () => {
            expect(
                scopeHasJoin(
                    baseScope
                        .innerJoin(SchoolMembership, 'memberships')
                        .innerJoin(School, 'school'),
                    SchoolMembership
                )
            ).to.be.true
        })
    })
})
