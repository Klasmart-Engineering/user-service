import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { createUser } from '../factories/user.factory'
import { generateToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { v4 as uuid_v4 } from 'uuid'

function makeRequest(token: string, query: string) {
    return supertest('http://localhost:8080')
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query,
        })
}

describe('acceptance.myUser', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('MyUser.node', () => {
        const query = `
            query {
                myUser {
                    node {
                        id
                    }
                }
            }
        `

        it('returns the user connection node for the active user', async () => {
            const user = await createUser().save()
            const token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })
            const response = await makeRequest(token, query)
            expect(response.status).to.eq(200)
            expect(response.body.data.myUser.node.id).to.eq(user.user_id)
        })
        it('errors if the user is not found', async () => {
            const token = generateToken({
                id: uuid_v4(),
                email: 'a@b.com',
                iss: 'calmid-debug',
            })
            const response = await makeRequest(token, query)
            expect(response.status).to.eq(200)
            expect(response.body.errors).exist
        })
    })
})
