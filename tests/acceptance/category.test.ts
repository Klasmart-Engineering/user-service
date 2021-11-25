import { expect, use } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Category } from '../../src/entities/category'
import CategoriesInitializer from '../../src/initializers/categories'
import {
    CategoryConnectionNode,
    CreateCategoryInput,
} from '../../src/types/graphQL/category'
import { loadFixtures } from '../utils/fixtures'
import {
    createCategories,
    createOrg,
    createSubcategories,
    ICategoryDetail,
    ISubcategoryDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import {
    ADD_SUBCATEGORIES_TO_CATEGORIES,
    CATEGORIES_CONNECTION,
    CATEGORY_NODE,
    CREATE_CATEGORIES,
} from '../utils/operations/modelOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { makeRequest } from './utils'
import { User } from '../../src/entities/user'
import { createOrganization } from '../factories/organization.factory'
import { createUser } from '../factories/user.factory'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { userToPayload } from '../utils/operations/userOps'
import { NIL_UUID } from '../utils/database'

use(deepEqualInAnyOrder)

interface ICategoryEdge {
    node: CategoryConnectionNode
}
let systemcategoriesCount = 0
const url = 'http://localhost:8080/user'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const categoriesCount = 12

async function makeQuery(pageSize: any) {
    return makeRequest(
        request,
        CATEGORIES_CONNECTION,
        {
            direction: 'FORWARD',
            directionArgs: { count: pageSize },
        },
        getAdminAuthToken()
    )
}

const makeNodeQuery = async (id: string) => {
    return makeRequest(
        request,
        print(CATEGORY_NODE),
        { id },
        getAdminAuthToken()
    )
}

describe('acceptance.category', () => {
    let connection: Connection
    let orgId: string

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await CategoriesInitializer.run()
        await loadFixtures('users', connection)

        const categoriesDetails: ICategoryDetail[] = []
        const createOrgResponse = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrgData =
            createOrgResponse.body.data.user.createOrganization

        orgId = createOrgData.organization_id

        for (let i = 1; i <= categoriesCount; i++) {
            categoriesDetails.push({
                name: `category ${i}`,
                system: true,
            })
        }

        for (let i = 1; i <= categoriesCount; i++) {
            categoriesDetails.push({
                name: `category b${i}`,
                system: false,
            })
        }

        await createCategories(orgId, categoriesDetails, getAdminAuthToken())

        systemcategoriesCount = await connection.manager.count(Category, {
            where: { system: true },
        })
    })

    context('categoriesConnection', () => {
        it('queries paginated categories', async () => {
            const pageSize = 5

            const response = await makeQuery(pageSize)

            const categoriesConnection = response.body.data.categoriesConnection

            expect(response.status).to.eq(200)
            expect(categoriesConnection.totalCount).to.equal(
                systemcategoriesCount
            )
            expect(categoriesConnection.edges.length).to.equal(pageSize)
        })

        it('fails validation', async () => {
            const pageSize = 'not_a_number'
            const response = await makeQuery(pageSize)

            expect(response.status).to.eq(400)
            expect(response.body.errors.length).to.equal(1)
            const message = response.body.errors[0].message
            expect(message)
                .to.be.a('string')
                .and.satisfy((msg: string) =>
                    msg.startsWith(
                        'Variable "$directionArgs" got invalid value "not_a_number" at "directionArgs.count"; Expected type "PageSize".'
                    )
                )
        })
    })

    context('categoryNode', () => {
        let categoriesEdges: ICategoryEdge[]
        beforeEach(async () => {
            const categoryResponse = await makeQuery(1)
            categoriesEdges =
                categoryResponse.body.data.categoriesConnection.edges
        })
        context('when requested category exists', () => {
            it('should respond successfully', async () => {
                const categoryId = categoriesEdges[0].node.id
                const response = await makeNodeQuery(categoryId)
                const categoryNode = response.body.data.categoryNode

                expect(response.status).to.eq(200)
                expect(categoryNode.id).to.equal(categoryId)
            })
        })

        context('when requested category does not exists', () => {
            it('should respond with errors', async () => {
                const categoryId = '00000000-0000-0000-0000-000000000000'
                const response = await makeNodeQuery(categoryId)
                const errors = response.body.errors
                const categoryNode = response.body.data.categoryNode

                expect(response.status).to.eq(200)
                expect(errors).to.exist
                expect(categoryNode).to.be.null
            })
        })
    })

    context('createCategories', () => {
        let category1Input: CreateCategoryInput
        let category2Input: CreateCategoryInput

        const makeCreateCategoriesMutation = async (
            input: CreateCategoryInput[]
        ) => {
            return await makeRequest(
                request,
                print(CREATE_CATEGORIES),
                { input },
                getAdminAuthToken()
            )
        }

        beforeEach(async () => {
            category1Input = {
                name: 'Acceptance Category 1',
                organizationId: orgId,
            }

            category2Input = {
                name: 'Acceptance Category 2',
                organizationId: orgId,
            }
        })

        context('when input is sent in a correct way', () => {
            it('should respond succesfully', async () => {
                const input = [category1Input, category2Input]
                const response = await makeCreateCategoriesMutation(input)
                const categories =
                    response.body.data.createCategories.categories

                expect(response.status).to.eq(200)
                expect(categories).to.exist
                expect(categories).to.be.an('array')
                expect(categories.length).to.eq(input.length)

                const categoriesCreatedNames = categories.map(
                    (cc: CategoryConnectionNode) => cc.name
                )

                const inputNames = input.map((i) => i.name)

                expect(categoriesCreatedNames).to.deep.equalInAnyOrder(
                    inputNames
                )
            })
        })

        context('when input is sent in an incorrect way', () => {
            it('should respond with errors', async () => {
                const input = [category1Input, category1Input]
                const response = await makeCreateCategoriesMutation(input)
                const categoriesCreated = response.body.data.createCategories
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(categoriesCreated).to.be.null
                expect(errors).to.exist
            })
        })
    })

    context('addSubcategoriesToCategories', () => {
        context('when id exists', () => {
            let categoryId: string
            let subcategoryId: string
            let user: User
            let token: string
            beforeEach(async () => {
                const org1 = await createOrganization().save()
                user = await createUser().save()
                const edutSubjectsRole = await createRole(
                    'Edit Subjects',
                    org1,
                    {
                        permissions: [PermissionName.edit_subjects_20337],
                    }
                ).save()
                const createSubjectsRole = await createRole(
                    'Create Subjects',
                    org1,
                    {
                        permissions: [PermissionName.create_subjects_20227],
                    }
                ).save()
                await createOrganizationMembership({
                    user,
                    organization: org1,
                    roles: [createSubjectsRole, edutSubjectsRole],
                }).save()
                token = generateToken(userToPayload(user))
                const categoriesDetails: ICategoryDetail[] = [
                    {
                        name: `category 0`,
                        system: false,
                    },
                ]
                const subcategoriesDetails: ISubcategoryDetail[] = [
                    {
                        name: `subcategory 0`,
                        system: false,
                    },
                ]
                const res = await createSubcategories(
                    org1.organization_id,
                    subcategoriesDetails,
                    token
                )
                const resCat = await createCategories(
                    org1.organization_id,
                    categoriesDetails,
                    token
                )

                categoryId =
                    resCat.body.data.organization.createOrUpdateCategories[0].id
                subcategoryId =
                    res.body.data.organization.createOrUpdateSubcategories[0].id
            })
            it('should respond successfully', async () => {
                const response = await makeRequest(
                    request,
                    print(ADD_SUBCATEGORIES_TO_CATEGORIES),
                    {
                        input: [
                            { categoryId, subcategoryIds: [subcategoryId] },
                        ],
                    },
                    token
                )
                const categoryNode =
                    response.body.data.addSubcategoriesToCategories
                        .categories[0]

                expect(response.status).to.eq(200)
                expect(categoryNode.id).to.equal(categoryId)
            })
        })

        context('when sent ids do not exist', () => {
            it('should respond with errors', async () => {
                const response = await makeRequest(
                    request,
                    print(ADD_SUBCATEGORIES_TO_CATEGORIES),
                    {
                        input: [
                            {
                                categoryId: NIL_UUID,
                                subcategoryIds: [NIL_UUID],
                            },
                        ],
                    },
                    getAdminAuthToken()
                )
                const errors = response.body.errors
                expect(response.status).to.eq(200)
                expect(errors).to.exist
            })
        })
    })
})
