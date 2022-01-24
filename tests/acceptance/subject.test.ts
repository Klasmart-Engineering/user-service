import { expect, use } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Status } from '../../src/entities/status'
import { Subject } from '../../src/entities/subject'
import SubjectsInitializer from '../../src/initializers/subjects'
import { loadFixtures } from '../utils/fixtures'
import {
    createCategories,
    createOrg,
    createSubjects,
    deleteSubject,
    ICategoryDetail,
    ISubjectDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { SUBJECTS_CONNECTION, SUBJECT_NODE } from '../utils/operations/modelOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { SubjectConnectionNode } from '../../src/types/graphQL/subject'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { NIL_UUID } from '../utils/database'
import { makeRequest } from './utils'
import { User } from '../../src/entities/user'
import { Organization } from '../../src/entities/organization'
import { createUser } from '../factories/user.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createOrganization } from '../factories/organization.factory'
import { createSubject } from '../factories/subject.factory'
import { createProgram } from '../factories/program.factory'
import { gql } from 'apollo-server-core'
import { Category } from '../../src/entities/category'
import { createCategory } from '../factories/category.factory'
import { CategoryConnectionNode } from '../../src/types/graphQL/category'
import { createClass } from '../factories/class.factory'
import { ClassConnectionNode } from '../../src/types/graphQL/class'
import { Class } from '../../src/entities/class'
import { Program } from '../../src/entities/program'
import { ProgramConnectionNode } from '../../src/types/graphQL/program'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import {
    CREATE_SUBJECTS,
    UPDATE_SUBJECTS,
} from '../utils/operations/subjectOps'
import { userToPayload } from '../utils/operations/userOps'
import { beforeEach } from 'mocha'
import { UserPermissions } from '../../src/permissions/userPermissions'

interface ISubjectEdge {
    node: SubjectConnectionNode
}

const url = 'http://localhost:8080/user'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const categoriesCount = 8
const subjectsCount = 4
const programsCount = 2

let org1Id: string
let categoryIds: string[]
let subjectIds: string[]
let systemSubjectsCount = 0

use(deepEqualInAnyOrder)

describe('acceptance.subject', () => {
    let connection: Connection

    async function makeConnectionQuery(pageSize: number) {
        return makeRequest(
            request,
            print(SUBJECTS_CONNECTION),
            {
                direction: 'FORWARD',
                directionArgs: { count: pageSize },
            },
            getAdminAuthToken()
        )
    }

    async function makeNodeQuery(id: string) {
        return makeRequest(
            request,
            print(SUBJECT_NODE),
            { id },
            getAdminAuthToken()
        )
    }

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await SubjectsInitializer.run()
        const categoryDetails: ICategoryDetail[] = []
        const subjectDetails: ISubjectDetail[] = []

        systemSubjectsCount = await connection.manager.count(Subject, {
            where: { system: true },
        })

        // Creating users
        await loadFixtures('users', connection)

        // Creating Org1
        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        org1Id = createOrg1Data.organization_id

        // Creating Categories
        for (let i = 0; i < categoriesCount; i++) {
            categoryDetails.push({
                name: `category ${i + 1}`,
            })
        }

        const createCategoriesResponse = await createCategories(
            org1Id,
            categoryDetails,
            getAdminAuthToken()
        )

        const createCategoriesData =
            createCategoriesResponse.body.data.organization
                .createOrUpdateCategories

        categoryIds = createCategoriesData.map(
            (c: { id: string; name: string; system: boolean }) => c.id
        )

        // Creating Subjects
        for (let i = 0; i < subjectsCount; i++) {
            const index = i * (categoriesCount / subjectsCount)

            subjectDetails.push({
                name: `subject ${i + 1}`,
                categories: [categoryIds[index], categoryIds[index + 1]],
            })
        }

        const createSubjectsResponse = await createSubjects(
            org1Id,
            subjectDetails,
            getAdminAuthToken()
        )

        const createSubjectsData =
            createSubjectsResponse.body.data.organization.createOrUpdateSubjects

        subjectIds = createSubjectsData.map(
            (s: { id: string; name: string; system: boolean }) => s.id
        )

        await deleteSubject(subjectIds[1], getAdminAuthToken())
    })

    context('subjectsConnection', () => {
        it('queries paginated subjects', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(
                subjectsCount + systemSubjectsCount
            )
        })

        it('queries paginated subjects sorted by ID', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(
                subjectsCount + systemSubjectsCount
            )
        })

        it('queries paginated subjects sorted by name', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'name',
                            order: 'DESC',
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(
                subjectsCount + systemSubjectsCount
            )
        })

        it('queries paginated subjects filtering by organization ID', async () => {
            const organizationId = org1Id
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(subjectsCount)
        })

        it('queries paginated subjects filtering by status', async () => {
            const status = Status.INACTIVE
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            status: {
                                operator: 'eq',
                                value: status,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(1)
        })

        it('queries paginated subjects filtering by system', async () => {
            const system = true
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            system: {
                                operator: 'eq',
                                value: system,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(systemSubjectsCount)
        })

        it('queries paginated subjects filtering by id', async () => {
            const subjectId = subjectIds[0]
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            id: {
                                operator: 'eq',
                                value: subjectId,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(1)
        })

        it('queries paginated subjects filtering by name', async () => {
            const search = '2'
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            name: {
                                operator: 'contains',
                                value: search,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.equal(1)
        })

        it('queries paginated subjects filtering by categories', async () => {
            const categoryId = categoryIds[0]
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(SUBJECTS_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            categoryId: {
                                operator: 'eq',
                                value: categoryId,
                            },
                        },
                    },
                })

            const subjectsConnection = response.body.data.subjectsConnection

            expect(response.status).to.eq(200)
            expect(subjectsConnection.totalCount).to.be.gte(1)
        })
    })

    context('subjectNode', () => {
        let subjects: ISubjectEdge[]

        beforeEach(async () => {
            const subjectsResponse = await makeConnectionQuery(10)
            subjects = subjectsResponse.body.data.subjectsConnection.edges
        })

        context('when requested subject exists', () => {
            it('responds succesfully', async () => {
                const subject = subjects[0].node
                const response = await makeNodeQuery(subject.id)
                const subjectNode = response.body.data.subjectNode

                expect(response.status).to.eq(200)
                expect(subjectNode.id).to.equal(subject.id)
                expect(subjectNode.name).to.equal(subject.name)
                expect(subjectNode.status).to.equal(subject.status)
                expect(subjectNode.system).to.equal(subject.system)

                const subjectCategories = subject.categories
                const subjectNodeCategories = subjectNode.categories

                expect(subjectNodeCategories).to.deep.equalInAnyOrder(
                    subjectCategories
                )
            })
        })

        context('when requested subject does not exists', () => {
            it('responds with errors', async () => {
                const subjectId = NIL_UUID
                const response = await makeNodeQuery(subjectId)
                const subjectNode = response.body.data.subjectNode
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(subjectNode).to.be.null
                expect(errors).to.exist
            })
        })
    })

    context('subjectsConnection as a child', () => {
        let user: User
        let organization: Organization
        let token: string
        let subject: Subject

        beforeEach(async () => {
            user = await createUser().save()
            organization = await createOrganization(user).save()

            const viewClassesRole = await createRole(
                'View Classes',
                organization,
                { permissions: [PermissionName.view_classes_20114] }
            ).save()

            await createOrganizationMembership({
                user,
                organization,
                roles: [viewClassesRole],
            }).save()

            subject = await createSubject(organization).save()
            token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })
        })

        context('of categories', () => {
            let category: Category
            const query = gql`
                query CategoriesConnection(
                    $direction: ConnectionDirection!
                    $directionArgs: ConnectionsDirectionArgs
                    $sortArgs: CategorySortInput
                ) {
                    categoriesConnection(
                        direction: $direction
                        directionArgs: $directionArgs
                        sort: $sortArgs
                    ) {
                        totalCount
                        edges {
                            cursor
                            node {
                                id
                                subjectsConnection {
                                    totalCount
                                    edges {
                                        cursor
                                        node {
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `

            beforeEach(async () => {
                category = createCategory(organization)
                category.subjects = Promise.resolve([subject])
                await category.save()
            })

            it('should retrieve the subjects for each category', async () => {
                const response = await makeRequest(
                    request,
                    print(query),
                    {
                        direction: 'FORWARD',
                        directionArgs: { count: 1 },
                        sortArgs: { order: 'ASC', field: 'name' },
                    },
                    token
                )

                expect(response.status).to.eq(200)

                const categoriesConnection =
                    response.body.data.categoriesConnection

                expect(categoriesConnection.totalCount).to.eq(1)
                expect(categoriesConnection.edges).to.have.lengthOf(1)

                categoriesConnection.edges.forEach(
                    (edge: { node: CategoryConnectionNode }) => {
                        expect(edge.node.id).to.eq(category.id)

                        const subjectsConnection = edge.node.subjectsConnection
                        expect(subjectsConnection?.totalCount).to.eq(1)
                        expect(subjectsConnection?.edges).to.have.lengthOf(1)
                        expect(subjectsConnection?.edges[0].node.id).to.eq(
                            subject.id
                        )
                    }
                )
            })
        })

        context('of classes', () => {
            let class_: Class
            const query = gql`
                query ClassesConnection(
                    $direction: ConnectionDirection!
                    $directionArgs: ConnectionsDirectionArgs
                    $sortArgs: ClassSortInput
                ) {
                    classesConnection(
                        direction: $direction
                        directionArgs: $directionArgs
                        sort: $sortArgs
                    ) {
                        totalCount
                        edges {
                            cursor
                            node {
                                id
                                subjectsConnection {
                                    totalCount
                                    edges {
                                        cursor
                                        node {
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `

            beforeEach(async () => {
                class_ = createClass(undefined, organization)
                class_.subjects = Promise.resolve([subject])
                await class_.save()
            })

            it('should retrieve the subjects for each class', async () => {
                const response = await makeRequest(
                    request,
                    print(query),
                    {
                        direction: 'FORWARD',
                        directionArgs: { count: 1 },
                        sortArgs: { order: 'ASC', field: 'name' },
                    },
                    token
                )

                expect(response.status).to.eq(200)

                const classesConnection = response.body.data.classesConnection

                expect(classesConnection.totalCount).to.eq(1)
                expect(classesConnection.edges).to.have.lengthOf(1)

                classesConnection.edges.forEach(
                    (edge: { node: ClassConnectionNode }) => {
                        expect(edge.node.id).to.eq(class_.class_id)

                        const subjectsConnection = edge.node.subjectsConnection
                        expect(subjectsConnection?.totalCount).to.eq(1)
                        expect(subjectsConnection?.edges).to.have.lengthOf(1)
                        expect(subjectsConnection?.edges[0].node.id).to.eq(
                            subject.id
                        )
                    }
                )
            })
        })

        context('of programs', () => {
            let program: Program
            const query = gql`
                query ProgramsConnection(
                    $direction: ConnectionDirection!
                    $directionArgs: ConnectionsDirectionArgs
                    $sortArgs: ProgramSortInput
                ) {
                    programsConnection(
                        direction: $direction
                        directionArgs: $directionArgs
                        sort: $sortArgs
                    ) {
                        totalCount
                        edges {
                            cursor
                            node {
                                id
                                subjectsConnection {
                                    totalCount
                                    edges {
                                        cursor
                                        node {
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `

            beforeEach(async () => {
                program = await createProgram(
                    organization,
                    undefined,
                    undefined,
                    [subject]
                ).save()
            })

            it('should retrieve the subjects for each program', async () => {
                const response = await makeRequest(
                    request,
                    print(query),
                    {
                        direction: 'FORWARD',
                        directionArgs: { count: 1 },
                        sortArgs: { order: 'ASC', field: 'name' },
                    },
                    token
                )

                expect(response.status).to.eq(200)

                const programsConnection = response.body.data.programsConnection

                expect(programsConnection.totalCount).to.eq(1)
                expect(programsConnection.edges).to.have.lengthOf(1)

                programsConnection.edges.forEach(
                    (edge: { node: ProgramConnectionNode }) => {
                        expect(edge.node.id).to.eq(program.id)

                        const subjectsConnection = edge.node.subjectsConnection
                        expect(subjectsConnection?.totalCount).to.eq(1)
                        expect(subjectsConnection?.edges).to.have.lengthOf(1)
                        expect(subjectsConnection?.edges[0].node.id).to.eq(
                            subject.id
                        )
                    }
                )
            })
        })
    })

    const createCatIds = async () =>
        (
            await Category.save(
                Array.from(new Array(5), () => {
                    const category = createCategory(undefined)
                    category.system = true
                    return category
                })
            )
        ).map((c) => c.id)

    context('createSubjects', () => {
        let adminUser: User
        let organization: Organization
        let catIds: string[]

        const makeCreateSubjectsMutation = async (input: any, caller: User) => {
            return await makeRequest(
                request,
                print(CREATE_SUBJECTS),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            catIds = await createCatIds()
            organization = await createOrganization().save()
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [
                    {
                        organizationId: organization.organization_id,
                        name: 'New Subject',
                        categoryIds: catIds,
                    },
                ]

                const response = await makeCreateSubjectsMutation(
                    input,
                    adminUser
                )

                const { subjects } = response.body.data.createSubjects
                expect(response.status).to.eq(200)
                expect(subjects).to.have.lengthOf(input.length)
            })
        })

        it('has mandatory organizationId and name input fields', async () => {
            const response = await makeCreateSubjectsMutation(
                [{ categoryIds: catIds }],
                adminUser
            )

            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(2)

            expect(response.body.errors[0].message).to.contain(
                'Field "name" of required type "String!" was not provided.'
            )

            expect(response.body.errors[1].message).to.contain(
                'Field "organizationId" of required type "ID!" was not provided.'
            )
        })
    })

    context('updateSubjects', () => {
        let adminUser: User
        let catIds: string[]
        let subjectsToEdit: Subject[]

        const makeUpdateSubjectsMutation = async (input: any, caller: User) => {
            return await makeRequest(
                request,
                print(UPDATE_SUBJECTS),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            const org = await createOrganization().save()
            subjectsToEdit = await Subject.save(
                Array.from(new Array(3), () => createSubject(org))
            )

            catIds = await createCatIds()
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [
                    {
                        id: subjectsToEdit[0].id,
                        name: 'New Name',
                        categoryIds: catIds,
                    },
                ]

                const response = await makeUpdateSubjectsMutation(
                    input,
                    adminUser
                )

                const { subjects } = response.body.data.updateSubjects
                expect(response.status).to.eq(200)
                expect(subjects).to.have.lengthOf(input.length)
            })
        })

        it('has mandatory id field', async () => {
            const response = await makeUpdateSubjectsMutation(
                [{ name: 'New Name', categoryIds: catIds }],
                adminUser
            )

            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "id" of required type "ID!" was not provided.'
            )
        })
    })
})
