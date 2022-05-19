import { expect } from 'chai'
import { getRepository } from 'typeorm'
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder'
import { createEntityScope } from '../../../src/directives/isAdmin'
import { Organization } from '../../../src/entities/organization'
import { Role } from '../../../src/entities/role'
import { User } from '../../../src/entities/user'
import { usersConnectionQuery } from '../../../src/pagination/usersConnection'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { createClass } from '../../factories/class.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSchool } from '../../factories/school.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'

import { createUser } from '../../factories/user.factory'
import { userToPayload } from '../../utils/operations/userOps'

describe('usersConnection', () => {
    context('usersConnectionQuery', () => {
        let scope: SelectQueryBuilder<User>
        let expectedUser: User

        beforeEach(async () => {
            expectedUser = await createUser().save()
            await createUser().save()
            scope = getRepository(User).createQueryBuilder()
        })

        it('can filter by username', async () => {
            await usersConnectionQuery(scope, {
                username: { operator: 'eq', value: expectedUser.username },
            })
            const users = await scope.getMany()
            expect(users).to.have.length(1)
            expect(users[0].user_id).to.eq(expectedUser.user_id)
        })

        it('can filter by class ID', async () => {
            const class_ = await createClass(undefined, undefined, {
                students: [expectedUser],
            }).save()

            await usersConnectionQuery(scope, {
                classId: { operator: 'eq', value: class_.class_id },
            })
            const users = await scope.getMany()
            expect(users).to.have.length(1)
            expect(users[0].user_id).to.eq(expectedUser.user_id)
        })

        context('can filter by roleId', () => {
            let role: Role
            let org: Organization

            beforeEach(async () => {
                org = await createOrganization().save()
                role = await Role.findOneOrFail({
                    where: { role_name: 'Teacher' },
                })
                await createOrganizationMembership({
                    user: expectedUser,
                    organization: org,
                    roles: [role],
                }).save()

                const school = await createSchool(org).save()
                await createSchoolMembership({
                    user: expectedUser,
                    school,
                }).save()
            })

            it('as teacher in a school', async () => {
                scope = (await createEntityScope({
                    permissions: new UserPermissions(
                        userToPayload(expectedUser)
                    ),
                    entity: 'user',
                })) as SelectQueryBuilder<User>
                await usersConnectionQuery(scope, {
                    roleId: { operator: 'eq', value: role.role_id },
                })
                const users = await scope.getMany()
                expect(users).to.have.length(1)
                expect(users[0].user_id).to.eq(expectedUser.user_id)
            })
        })
    })
})
