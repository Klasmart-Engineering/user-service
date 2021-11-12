import supertest from 'supertest'

export async function makeRequest(
    request: supertest.SuperTest<supertest.Test>,
    query: string,
    variables: Record<string, unknown>,
    token?: string
) {
    return request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query,
            variables,
        })
}
