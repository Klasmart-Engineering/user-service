import { expect } from 'chai'
import { Connection, createQueryBuilder, SelectQueryBuilder } from 'typeorm'
import { distinctMembers } from '../../../src/directives/isAdminUtils'
import { User } from '../../../src/entities/user'
import { createTestConnection } from '../../utils/testConnection'

describe('isAdminUtils', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('distinctMembers', () => {
        let membershipTable: string
        let idColumn: string
        let ids: string[]

        beforeEach(() => {
            User.createQueryBuilder()
            membershipTable = 'SchoolMembership'
            idColumn = 'schoolSchoolId'
        })

        it('renders a valid SQL query given required parameters', () => {
            ids = ['school1Id', 'school2Id']

            const expectedQuery = createQueryBuilder()
                .select('membership_table.userUserId', 'user_id')
                .from('SchoolMembership', 'membership_table')
                .where('membership_table.schoolSchoolId IN (:...ids)', { ids })
                .getQueryAndParameters()
            const actualQuery = distinctMembers(
                membershipTable,
                idColumn,
                ids
            )?.getQueryAndParameters()

            expect(actualQuery).to.deep.equal(expectedQuery)
        })

        it('handles the case where no ids are passed in with undefined return', () => {
            ids = []

            const actualQuery = distinctMembers(
                membershipTable,
                idColumn,
                ids
            )?.getQueryAndParameters()

            expect(actualQuery).to.equal(undefined)
        })
    })
})
