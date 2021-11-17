import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Subcategory } from '../../src/entities/subcategory'
import {
    SUBCATEGORIES_CONNECTION,
    SUBCATEGORIES_DELETE,
    SUBCATEGORY_NODE,
} from '../utils/operations/modelOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { expect } from 'chai'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import { NIL_UUID } from '../utils/database'
import {
    createSubcategories,
    ISubcategoryDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { User } from '../../src/entities/user'
import { createUser } from '../factories/user.factory'
import { userToPayload } from '../utils/operations/userOps'
import { createRole } from '../factories/role.factory'
import { createOrganization } from '../factories/organization.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { makeRequest } from './utils'

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'

async function makeConnectionQuery() {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: print(SUBCATEGORIES_CONNECTION),
            variables: {
                direction: 'FORWARD',
            },
        })
}

const makeNodeQuery = async (id: string) => {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: print(SUBCATEGORY_NODE),
            variables: {
                id,
            },
        })
}

describe('acceptance.subcategory', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await SubcategoriesInitializer.run()
    })

    context('subcategoriesConnection', () => {
        let subcategoriesCount: number

        beforeEach(async () => {
            subcategoriesCount = await Subcategory.count()
        })

        context('when data is requested in a correct way', () => {
            it('should response with status 200', async () => {
                const response = await makeConnectionQuery()
                const subcategoriesConnection =
                    response.body.data.subcategoriesConnection

                expect(response.status).to.eq(200)
                expect(subcategoriesConnection.totalCount).to.equal(
                    subcategoriesCount
                )
            })
        })

        context('when data is requested in an incorrect way', () => {
            it('should response with status 400', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: print(SUBCATEGORIES_CONNECTION),
                        variables: {
                            direction: 'FORWARD',
                            filterArgs: {
                                byStatus: {
                                    operator: 'eq',
                                    value: 'available',
                                },
                            },
                        },
                    })

                const errors = response.body.errors
                const data = response.body.data

                expect(response.status).to.eq(400)
                expect(errors).to.exist
                expect(data).to.be.undefined
            })
        })
    })

    context('subcategoryNode', () => {
        context('when requested subcategory exists', () => {
            it('should respond succesfully', async () => {
                const subcategoryResponse = await makeConnectionQuery()
                const subcategoriesEdges =
                    subcategoryResponse.body.data.subcategoriesConnection.edges
                const subcategoryId = subcategoriesEdges[0].node.id
                const response = await makeNodeQuery(subcategoryId)
                const subcategoryNode = response.body.data.subcategoryNode

                expect(response.status).to.eq(200)
                expect(subcategoryNode.id).to.equal(subcategoryId)
            })
        })

        context('when requested subcategory does not exists', () => {
            it('should respond with errors', async () => {
                const response = await makeNodeQuery(NIL_UUID)
                const errors = response.body.errors
                const subcategoryNode = response.body.data.subcategoryNode

                expect(response.status).to.eq(200)
                expect(errors).to.exist
                expect(subcategoryNode).to.be.null
            })
        })
    })

    context('deleteSubcategories', () => {
        context('when id exists', () => {
            let subcategoryId: string
            let user: User
            let token: string
            beforeEach(async () => {
                const org1 = await createOrganization().save()
                user = await createUser().save()
                const deleteSubcategoriesRoleOrg1 = await createRole(
                    'Delete Subcategories',
                    org1,
                    {
                        permissions: [PermissionName.delete_subjects_20447],
                    }
                ).save()
                const createSubjectsRole = await createRole(
                    'Create Subcategories',
                    org1,
                    {
                        permissions: [PermissionName.create_subjects_20227],
                    }
                ).save()
                await createOrganizationMembership({
                    user,
                    organization: org1,
                    roles: [createSubjectsRole, deleteSubcategoriesRoleOrg1],
                }).save()
                token = generateToken(userToPayload(user))
                const subcategoriesDetails: ISubcategoryDetail[] = []
                for (let i = 0; i < 1; i++) {
                    subcategoriesDetails.push({
                        name: `subcategory ${i}`,
                        system: false,
                    })
                }
                const res = await createSubcategories(
                    org1.organization_id,
                    subcategoriesDetails,
                    token
                )
                subcategoryId =
                    res.body.data.organization.createOrUpdateSubcategories[0].id
            })
            it('should respond succesfully', async () => {
                const response = await makeRequest(
                    request,
                    print(SUBCATEGORIES_DELETE),
                    { input: [{ id: subcategoryId }] },
                    token
                )
                const subcategoryNode =
                    response.body.data.deleteSubcategories.subcategories[0]

                expect(response.status).to.eq(200)
                expect(subcategoryNode.id).to.equal(subcategoryId)
            })
        })

        context('when requested subcategory does not exists', () => {
            it('should respond with errors', async () => {
                const response = await makeRequest(
                    request,
                    print(SUBCATEGORIES_DELETE),
                    { input: [{ id: NIL_UUID }] },
                    getAdminAuthToken()
                )
                const errors = response.body.errors
                expect(response.status).to.eq(200)
                expect(errors).to.exist
            })
        })
    })
})
