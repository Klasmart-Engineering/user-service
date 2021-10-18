import { expect } from 'chai'
import { Connection, createQueryBuilder } from 'typeorm'
import { User } from '../../../src/entities/user'
import { convertRawToEntities } from '../../../src/utils/typeorm'
import { createUser } from '../../factories/user.factory'
import { createTestConnection } from '../../utils/testConnection'

describe('convertRawToEntities', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })
    it('converts a raw SQL result to typeorm entities', async () => {
        await createUser().save()
        const userQuery = createQueryBuilder(User)

        const rawResult = await userQuery.getRawMany()
        const entities = await convertRawToEntities(rawResult, userQuery)

        expect(entities).to.have.lengthOf(1)
        for (const user of entities) {
            expect(user).to.be.instanceOf(User)
        }
    })

    it('discards any additional columns', async () => {
        await createUser().save()
        const userQuery = createQueryBuilder(User).addSelect(
            'given_name',
            'column_to_discard'
        )

        const rawResult = await userQuery.getRawMany()
        const entities = await convertRawToEntities(rawResult, userQuery)

        expect(entities).to.have.lengthOf(1)
        for (const user of entities) {
            expect((user as any)['column_to_discard']).to.be.undefined
        }
    })
})
