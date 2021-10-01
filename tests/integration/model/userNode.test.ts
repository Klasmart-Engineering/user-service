import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { sortBy } from 'lodash'
import { Like } from 'typeorm'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
} from '../../../src/pagination/usersConnection'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { UserConnectionNode } from '../../../src/types/graphQL/userConnectionNode'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import {
    IEdge,
    convertDataToCursor,
} from '../../../src/utils/pagination/paginate'
import { createClass } from '../../factories/class.factory'
import {
    createOrganizations,
    createOrganization,
} from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import {
    ADMIN_EMAIL,
    createUser,
    createUsers,
} from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    usersConnectionNodes,
    userConnection,
    usersConnectionMainData,
    userNode,
} from '../../utils/operations/modelOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import { grantPermission } from '../../utils/operations/roleOps'
import {
    userToPayload,
    addOrganizationToUserAndValidate,
} from '../../utils/operations/userOps'
import {
    getAdminAuthToken,
    generateToken,
    getNonAdminAuthToken,
} from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'

use(deepEqualInAnyOrder)

describe('userNode', () => {
    let user: User
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    const expectUserConnectionEdge = (
        node: UserConnectionNode,
        u: User
    ) => {
        expect(node).to.deep.equal({
            id: u.user_id,
            givenName: u.given_name,
            familyName: u.family_name,
            avatar: u.avatar,
            status: u.status,
            dateOfBirth: u.date_of_birth,
            gender: u.gender,
            contactInfo: {
                email: u.email,
                phone: u.phone,
            },
            alternateContactInfo: {
                email: u.alternate_email,
                phone: u.alternate_phone,
            },
        } as Required<UserConnectionNode>)
    }

    context('data', () => {
        beforeEach(async () => {
            const newUser = createUser()
            // Populate fields not set in `createUser`
            newUser.avatar = 'some_image'
            newUser.alternate_email = faker.internet.email()
            newUser.alternate_phone = faker.phone.phoneNumber()
            user = await User.save(newUser)
        })

        it('populates a UserConnectionNode at each edge.node based on the User entity', async () => {
            const userNodeResponse = await userNode(
                testClient,
                { authorization: getAdminAuthToken() },
                user.user_id
            )

            expectUserConnectionEdge(userNodeResponse, user)
        })
    })

})
