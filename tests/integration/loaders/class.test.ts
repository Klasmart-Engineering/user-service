import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { User } from '../../../src/entities/user'
import { usersForClasses } from '../../../src/loaders/class'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { createClass } from '../../factories/class.factory'
import { createOrganization } from '../../factories/organization.factory'
import {
    createOrganizationMembership,
    createOrganizationMemberships,
} from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createUser, createUsers } from '../../factories/user.factory'
import { compareMultipleEntityFields } from '../../utils/assertions'
import { userToPayload } from '../../utils/operations/userOps'
import { TestConnection } from '../../utils/testConnection'

use(chaiAsPromised)

let connection: TestConnection

describe('class', () => {
    let myUser: User
    let organization: Organization
    let users: User[]

    before(() => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        myUser = await createUser().save()
        organization = await createOrganization().save()
        users = await User.save(createUsers(4))
    })

    context('when the client does not have permission to view users', () => {
        it('returns an array containing no users', async () => {
            const cls = await createClass([], organization, {
                students: users,
            }).save()

            const unauthorizedUser = await createUser().save()

            const usersFound = await usersForClasses(
                [cls.class_id],
                new UserPermissions(userToPayload(unauthorizedUser)),
                'classesStudying'
            )

            expect(usersFound[0]).to.be.empty
        })
    })

    context('when the client has permission to view users', () => {
        beforeEach(async () => {
            const role = await createRole(undefined, organization, {
                permissions: [PermissionName.view_users_40110],
            }).save()

            const myMembership = createOrganizationMembership({
                user: myUser,
                organization,
                roles: [role],
            })
            await OrganizationMembership.save([
                myMembership,
                ...createOrganizationMemberships(users, organization),
            ])
        })

        context('when retrieving students for classes', () => {
            it('returns an array containing students for each class', async () => {
                const class1Users = users.slice(0, 2)
                const class2Users = users.slice(2, 4)

                const class1 = await createClass([], organization, {
                    students: class1Users,
                }).save()
                const class2 = await createClass([], organization, {
                    students: class2Users,
                }).save()

                const usersFound = await usersForClasses(
                    [class1.class_id, class2.class_id],
                    new UserPermissions(userToPayload(myUser)),
                    'classesStudying'
                )

                compareMultipleEntityFields(usersFound[0], class1Users, [
                    'user_id',
                ])
                compareMultipleEntityFields(usersFound[1], class2Users, [
                    'user_id',
                ])
            })

            it('makes the same number of database calls regardless of size', async () => {
                const simpleClass = await createClass([], organization, {
                    students: [users[0]],
                }).save()

                const classes = await Class.save([
                    createClass([], organization, {
                        students: [users[2], users[3]],
                    }),
                    createClass([], organization, {
                        students: users,
                    }),
                    createClass([], organization, {
                        students: [users[0], users[1]],
                    }),
                ])

                connection.logger.reset()
                await usersForClasses(
                    [simpleClass.class_id],
                    new UserPermissions(userToPayload(myUser)),
                    'classesStudying'
                )
                const baseCount = connection.logger.count

                connection.logger.reset()
                await usersForClasses(
                    classes.map((c) => c.class_id),
                    new UserPermissions(userToPayload(myUser)),
                    'classesStudying'
                )
                expect(connection.logger.count).to.equal(baseCount)
            })
        })

        context('when retrieving teachers for classes', () => {
            it('returns an array containing teachers for each class', async () => {
                const class1Users = users.slice(0, 2)
                const class2Users = users.slice(2, 4)

                const class1 = await createClass([], organization, {
                    teachers: [users[0], users[1]],
                }).save()
                const class2 = await createClass([], organization, {
                    teachers: [users[2], users[3]],
                }).save()

                const usersFound = await usersForClasses(
                    [class1.class_id, class2.class_id],
                    new UserPermissions(userToPayload(myUser)),
                    'classesTeaching'
                )

                compareMultipleEntityFields(usersFound[0], class1Users, [
                    'user_id',
                ])
                compareMultipleEntityFields(usersFound[1], class2Users, [
                    'user_id',
                ])
            })
        })
    })
})
