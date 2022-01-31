import { expect } from 'chai'
import { getRepository } from 'typeorm'
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder'
import { User } from '../../../src/entities/user'
import { eligibleMemberConnectionQuery } from '../../../src/pagination/eligibleMembersConnection'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { createClass } from '../../factories/class.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createUser } from '../../factories/user.factory'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'

describe('eligibleMembersConnection', () => {
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('eligibleMemberConnectionQuery', () => {
        let scope: SelectQueryBuilder<User>

        it('can filter by username', async () => {
            const org = await createOrganization().save()
            const cls = await createClass(undefined, org).save()
            const expectedUser = await createUser().save()
            const unexpectedUser = await createUser().save()
            const role = await createRole(undefined, undefined, {
                permissions: [
                    PermissionName.attend_live_class_as_a_teacher_186,
                ],
            }).save()
            await createOrganizationMembership({
                user: expectedUser,
                organization: org,
                roles: [role],
            }).save()
            await createOrganizationMembership({
                user: unexpectedUser,
                organization: org,
                roles: [role],
            }).save()

            scope = getRepository(User).createQueryBuilder()
            await eligibleMemberConnectionQuery(
                scope,
                cls.class_id,
                PermissionName.attend_live_class_as_a_teacher_186,
                { username: { operator: 'eq', value: expectedUser.username } }
            )
            const users = await scope.getMany()
            expect(users).to.have.length(1)
            expect(users[0].user_id).to.eq(expectedUser.user_id)
            expect(users[0].username).to.eq(expectedUser.username)
        })
    })
})
