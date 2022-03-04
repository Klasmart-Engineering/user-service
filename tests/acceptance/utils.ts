import supertest from 'supertest'
import { expect } from 'chai'
import { IPaginatedResponse } from '../../src/utils/pagination/paginate'
import request from 'supertest'

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

export async function failsValidation(response: request.Response) {
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
}

export function checkPageInfo(
    result: IPaginatedResponse,
    expectedTotalCount?: number
) {
    if (expectedTotalCount != undefined)
        expect(result.totalCount).to.eq(expectedTotalCount)
    expect(result.pageInfo.hasNextPage).to.be.true
    expect(result.pageInfo.hasPreviousPage).to.be.false
    expect(result.pageInfo.startCursor).to.be.string
    expect(result.pageInfo.endCursor).to.be.string
    expect(result.edges.length).eq(10)
}
