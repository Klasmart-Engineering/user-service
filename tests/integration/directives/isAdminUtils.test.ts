import { expect } from 'chai'
import { getConnection, SelectQueryBuilder } from 'typeorm'
import { createEntityScope } from '../../../src/directives/isAdmin'
import { isAdminUserScopeWrapper } from '../../../src/directives/isAdminUtils'
import { User } from '../../../src/entities/user'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createUser, createUsers } from '../../factories/user.factory'
import { TestConnection } from '../../utils/testConnection'

describe('isAdminUtils', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    const makeClientScopeAndOrg = async () => {
        const clientUser = await createUser().save()
        const clientUsersOrg = await createOrganization().save()
        const clientRole = await createRole(undefined, clientUsersOrg, {
            permissions: [PermissionName.view_users_40110],
        }).save()
        await createOrganizationMembership({
            user: clientUser,
            organization: clientUsersOrg,
            roles: [clientRole],
        }).save()

        const token = { id: clientUser.user_id }
        const permissions = new UserPermissions(token)

        const scope = (await createEntityScope({
            permissions,
            entity: 'user',
        })) as SelectQueryBuilder<User>
        return { scope, organization: clientUsersOrg }
    }

    context('isAdminUserScopeWrapper', () => {
        it('returns users when users are in scope', async () => {
            const { scope, organization } = await makeClientScopeAndOrg()

            const users = createUsers(2)
            await connection.manager.save(users)
            const orgMemberships = users.map((user) =>
                createOrganizationMembership({
                    user,
                    organization,
                })
            )
            await connection.manager.save(orgMemberships)

            const returnedUsers = await isAdminUserScopeWrapper(
                scope,
                Promise.resolve(users)
            )
            expect(returnedUsers).to.deep.eq(users)
        })

        it('returns undefined when users are not in scope', async () => {
            const { scope } = await makeClientScopeAndOrg()

            const users = createUsers(2)
            await connection.manager.save(users)

            const returnedUsers = await isAdminUserScopeWrapper(
                scope,
                Promise.resolve(users)
            )
            expect(returnedUsers).to.be.undefined
        })

        it('handles empty user arrays', async () => {
            const { scope } = await makeClientScopeAndOrg()

            const users: User[] = []

            const returnedUsers = await isAdminUserScopeWrapper(
                scope,
                Promise.resolve(users)
            )
            expect(returnedUsers).to.be.empty
        })
    })
})
