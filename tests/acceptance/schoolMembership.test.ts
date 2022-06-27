import { createOrganization } from '../factories/organization.factory'
import { expect, use } from 'chai'
import { createUser } from '../factories/user.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import supertest from 'supertest'
import { generateToken } from '../utils/testConfig'
import { createRole } from '../factories/role.factory'
import { makeRequest } from './utils'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { userToPayload } from '../utils/operations/userOps'

const request = supertest('http://localhost:8080/user')

use(deepEqualInAnyOrder)

describe('acceptance.SchoolMembership', () => {
    context('schoolMembershipConnection', () => {
        it('has rolesConnection as a child', async () => {
            const query = `
                query rolesConnection($schoolId: ID!, $direction: ConnectionDirection!, $filter: RoleFilter) {
                    # we don't expose membership connections at top-level
                    # so have to go via a node
                    schoolNode(id: $schoolId){
                        schoolMembershipsConnection{
                            edges {
                                node {
                                    schoolId,
                                    rolesConnection(direction:$direction, filter: $filter){
                                        edges{
                                            node{
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`

            const organization = await createOrganization().save()
            const orgRole = await createRole('role1', organization, {
                permissions: [PermissionName.view_school_20110],
            }).save()
            const member = await createUser().save()
            await createOrganizationMembership({
                user: member,
                organization,
                roles: [orgRole],
            }).save()

            const school = await createSchool(organization).save()
            const role = await createRole('schoolRole', organization).save()
            await createSchoolMembership({
                user: member,
                school,
                roles: [role],
            }).save()

            const token = generateToken(userToPayload(member))

            const response = await makeRequest(
                request,
                query,
                {
                    schoolId: school.school_id,
                    direction: 'FORWARD',
                    filter: {
                        name: {
                            operator: 'eq',
                            value: role.role_name,
                        },
                    },
                },
                token
            )
            expect(
                response.body.data.schoolNode.schoolMembershipsConnection
                    .edges[0].node.schoolId
            ).to.eq(school.school_id)
            expect(
                response.body.data.schoolNode.schoolMembershipsConnection
                    .edges[0].node.rolesConnection.edges[0].node.id
            ).to.eq(role.role_id)
        })
    })
})
