import { expect } from 'chai'
import { getConnection } from 'typeorm'
import { Model } from '../../src/model'
import { TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Class } from '../../src/entities/class'
import { createClass } from '../utils/operations/organizationOps'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { accountUUID } from '../../src/entities/user'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { getAdminAuthToken, getNonAdminAuthToken } from '../utils/testConfig'
import faker from 'faker'

const GET_CLASSES = `
    query getClasses {
        classes {
            class_id
            class_name
        }
    }
`

const GET_CLASS = `
    query myQuery($class_id: ID!) {
        class(class_id: $class_id) {
            class_id
            class_name
        }
    }
`

export const GET_CLASS_NODE = `
    query myQuery($id: ID!) {
        classNode(id: $id) {
            id
            name
        }
    }
`

describe('model.class', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    let arbitraryUserToken: string

    beforeEach(async () => {
        await createNonAdminUser(testClient)
        arbitraryUserToken = getNonAdminAuthToken()
    })

    describe('getClasses', () => {
        context('when none', () => {
            it('should return an empty array', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_CLASSES,
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const classes = res.data?.classes as Class[]
                expect(classes).to.exist
                expect(classes).to.have.lengthOf(0)
            })
        })

        context('when one', () => {
            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    getAdminAuthToken()
                )
                await createClass(
                    testClient,
                    organization.organization_id,
                    undefined,
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return an array containing one class', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_CLASSES,
                    headers: { authorization: getAdminAuthToken() },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const classes = res.data?.classes as Class[]
                expect(classes).to.exist
                expect(classes).to.have.lengthOf(1)
            })
        })
    })

    describe('getClass', () => {
        context('when none', () => {
            it('should return null', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_CLASS,
                    variables: { class_id: accountUUID() },
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                expect(res.data?.class).to.be.null
            })
        })

        context('when one', () => {
            let cls: Class

            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    undefined,
                    undefined,
                    getAdminAuthToken()
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id,
                    undefined,
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return the class associated with the specified ID for an admin', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_CLASS_NODE,
                    variables: { id: cls.class_id },
                    headers: { authorization: getAdminAuthToken() },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const gqlClass = res.data?.classNode
                expect(gqlClass).to.exist
                expect(cls.class_id).to.equal(gqlClass.id)
            })

            it('should return error with the specified ID for non admin / non member', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_CLASS_NODE,
                    variables: { id: cls.class_id },
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors?.length).to.be.greaterThanOrEqual(1)
                const gqlClass = res.data?.classNode
                expect(gqlClass).to.be.null
            })

            it('should return error when the class does not exist with specified id', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_CLASS_NODE,
                    variables: { id: faker.datatype.uuid() },
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors?.length).to.be.greaterThanOrEqual(1)
            })
        })
    })
})
