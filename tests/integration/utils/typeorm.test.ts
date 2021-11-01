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
        const convertedEntities = await convertRawToEntities(
            rawResult,
            userQuery
        )
        const typeormEntities = await userQuery.getMany()

        expect(convertedEntities).to.have.lengthOf(1)
        for (const user of convertedEntities) {
            expect(user).to.be.instanceOf(User)

            const typeormEntity = typeormEntities.find(
                (e) => e.user_id === user?.user_id
            )
            expect(typeormEntity).to.exist
            expect(JSON.stringify(typeormEntity)).to.eq(JSON.stringify(user))
            expect(JSON.stringify(user)).to.eq(JSON.stringify(typeormEntity))
        }
    })

    it('discards any columns not defined by the entity', async () => {
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
    it('returns undefined for invalid objects', async () => {
        await createUser().save()
        const userQuery = createQueryBuilder(User)

        const entities = await convertRawToEntities(
            [{ random: 'object' }],
            userQuery
        )
        expect(entities).to.have.lengthOf(1)
        expect(entities[0]).to.be.undefined
    })
    it('does not deduplicate', async () => {
        await createUser().save()
        const userQuery = createQueryBuilder(User)
        const rawResult = await userQuery.getRawMany()

        const entities = await convertRawToEntities(
            [...rawResult, ...rawResult],
            userQuery
        )
        expect(entities).to.have.lengthOf(2)
    })
})
