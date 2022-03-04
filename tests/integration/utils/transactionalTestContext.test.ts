import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getManager } from 'typeorm'
import { Role } from '../../../src/entities/role'
import { User } from '../../../src/entities/user'
import { createUser } from '../../factories/user.factory'
import { compareEntities } from '../../utils/assertions'

use(chaiAsPromised)

describe('transactions', () => {
    context('rollback works as expected', () => {
        context('when a user is added in the beforeEach', () => {
            let user: User
            beforeEach(async () => (user = await createUser().save()))
            it('finds the only user in the database', async () => {
                const allUsers = await User.find()
                expect(allUsers).to.have.lengthOf(1)
                compareEntities(allUsers[0], user)
            })
        })
        context('when a user is added in the test', () => {
            it('finds the only user in the database', async () => {
                const user = await createUser().save()
                const allUsers = await User.find()
                expect(allUsers).to.have.lengthOf(1)
                compareEntities(allUsers[0], user)
            })
        })
        context('when no user is added', () => {
            it('finds no users in the database', async () => {
                const allUsers = await User.find()
                expect(allUsers).to.have.lengthOf(0)
            })
        })
    })

    context('roles are initialized', () => {
        it('finds system roles', async () => {
            const allSystemRoles = await Role.find({
                where: { system_role: true },
            })
            expect(allSystemRoles).to.not.be.empty
        })
    })

    context('handles nested transaction', () => {
        it('does not error when it encounters a nested transaction', async () => {
            await getManager().transaction(async (manager) => {
                await manager.save(createUser())
            })
        })

        it('rolls back nested transaction when it errors', async () => {
            await createUser().save()
            await expect(
                getManager().transaction(async (manager) => {
                    await manager.save(createUser())
                    expect(await User.count()).to.equal(2)
                    throw new Error('this error triggers a rollback')
                })
            ).to.be.rejectedWith('this error triggers a rollback')
            expect(await User.count()).to.equal(1)
        })
    })
})
