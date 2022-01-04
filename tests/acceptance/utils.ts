import supertest from 'supertest'

export async function makeRequest(
    request: supertest.SuperTest<supertest.Test>,
    query: string,
    variables: Record<string, unknown>,
    token?: string
) {
    const headers: { [key: string]: string } = {
        ContentType: 'application/json',
    }

    if (token !== undefined) {
        headers.Authorization = token
    }

    return request.post('/user').set(headers).send({
        query,
        variables,
    })
}
