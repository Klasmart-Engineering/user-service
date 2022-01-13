import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import _ from 'lodash'
import { Connection } from 'typeorm'
import { AddIdProviderColumnToUser1642080667584 } from '../../migrations/1642080667584-AddIdProviderColumnToUser'
import { User } from '../../src/entities/user'
import { createUser, createUsers } from '../factories/user.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'

use(chaiAsPromised)

describe('AddIdpColumnToUser1642080667584 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let users: User[]
    const validationError =
        'duplicate key value violates unique constraint "UQ_USERNAME_ID_PROVIDER"'

    before(async () => {
        baseConnection = await createTestConnection()
    })
    after(async () => {
        await baseConnection?.close()
    })
    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })
    beforeEach(async () => {
        migrationsConnection = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        await migrationsConnection.runMigrations()
    })
    it('saves the id_provider', async () => {
        const user = await createUser({ id_provider: '177286' }).save()
        expect(user.id_provider).to.equal('177286')
    })
    it('is benign if run twice', async () => {
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === AddIdProviderColumnToUser1642080667584.name
        )
        const runner = baseConnection.createQueryRunner()
        // promise will be rejected if migration fails
        await expect(migration!.up(runner)).to.be.fulfilled
        // return migration!.up(runner).should.be.fulfilled
    })
    context(
        'when two users have the same username and id_provider in the same transaction',
        () => {
            beforeEach(() => {
                users = createUsers(2, {
                    username: 'carl321',
                    id_provider: 'c19e0e',
                })
            })
            it('returns a database error', async () => {
                await expect(User.save(users)).to.be.rejectedWith(
                    validationError
                )
            })
        }
    )
    context(
        'when two users have the same username and id_provider in separate transactions',
        () => {
            it('returns a database error', async () => {
                beforeEach(() => {
                    users = createUsers(2, {
                        username: 'carl321',
                        id_provider: 'c19e0e',
                    })
                })
                it('returns a database error', async () => {
                    await expect(users[0].save()).to.be.fulfilled
                    await expect(users[1].save()).to.be.rejectedWith(
                        validationError
                    )
                })
            })
        }
    )
    context(
        'when two users have the same username but different id_providers',
        () => {
            it('adds the users', async () => {
                beforeEach(() => {
                    users = createUsers(2, {
                        username: 'carl321',
                    })
                    users[0].id_provider = 'b96371'
                    users[1].id_provider = 'a94a2a'
                })
                it('saves the users', async () => {
                    await expect(User.save(users)).to.be.fulfilled
                })
            })
        }
    )
    context(
        'when two users have the same id_provider but different usernames',
        () => {
            it('adds the users', async () => {
                beforeEach(() => {
                    users = createUsers(2, {
                        id_provider: 'c19e0e',
                    })
                    users[0].username = 'carl321'
                    users[1].username = 'bonnie092'
                })
                it('saves the users', async () => {
                    await expect(User.save(users)).to.be.fulfilled
                })
            })
        }
    )
})
