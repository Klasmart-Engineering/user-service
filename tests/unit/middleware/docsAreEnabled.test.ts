import { Request, Response } from 'express'
import sinon from 'sinon'
import { docsAreEnabled } from '../../../src/app'
import { createRequest } from 'node-mocks-http'

describe('docsAreEnabled middleware', () => {
    function createResponse() {
        const resp: Partial<Response> = {}
        resp.locals = {}
        resp.status = sinon.stub().returns(resp)
        resp.send = sinon.stub().returns(resp)
        return resp as Response
    }

    it('passes in "development" environments', async () => {
        process.env.NODE_ENV = 'development'
        const mockResponse = createResponse()
        const nextFunction = sinon.spy()
        await docsAreEnabled({} as Request, mockResponse, nextFunction)
        sinon.assert.calledOnce(nextFunction)
    })

    it('blocks in non-"development" environments', async () => {
        const environments = [
            'dev',
            'prod',
            'test',
            'production',
            '',
            undefined,
        ]
        for (const e of environments) {
            process.env.NODE_ENV = e
            process.env.USER_SERVICE_API_KEY = 'my-api-key'
            const mockResponse = createResponse()
            const nextFunction = sinon.spy()

            const req = createRequest({
                headers: {
                    Authorization: 'Bearer my-api-key',
                },
            })

            await docsAreEnabled(req as Request, mockResponse, nextFunction)
            sinon.assert.calledOnceWithMatch(
                mockResponse.status as sinon.SinonStub,
                403
            )
            sinon.assert.calledOnceWithMatch(
                mockResponse.send as sinon.SinonStub,
                'Docs are disabled on this server.'
            )
            sinon.assert.notCalled(nextFunction)
        }
    })

    it('does not block in non-"development" environments if ENABLE_PAGE_DOCS="1"', async () => {
        const environments = [
            'dev',
            'prod',
            'test',
            'production',
            '',
            undefined,
        ]
        for (const e of environments) {
            process.env.NODE_ENV = e
            process.env.ENABLE_PAGE_DOCS = '1'
            process.env.USER_SERVICE_API_KEY = 'my-api-key'
            const mockResponse = createResponse()
            const nextFunction = sinon.spy()

            const req = createRequest({
                headers: {
                    Authorization: 'Bearer my-api-key',
                },
            })

            await docsAreEnabled(req as Request, mockResponse, nextFunction)
            sinon.assert.calledOnce(nextFunction)
        }
    })

    it('passes when ENABLE_PAGE_DOCS === "1"', async () => {
        process.env.ENABLE_PAGE_DOCS = '1'
        process.env.USER_SERVICE_API_KEY = 'my-api-key'
        const req = createRequest({
            headers: {
                Authorization: 'Bearer my-api-key',
            },
        })
        const mockResponse = createResponse()
        const nextFunction = sinon.spy()
        void docsAreEnabled(req as Request, mockResponse, nextFunction)
        sinon.assert.calledOnce(nextFunction)
    })
    it('blocks when ENABLE_PAGE_DOCS != "1"', async () => {
        const values = ['0', 'false', '', undefined, '2', 'true', 'on']
        for (const v of values) {
            process.env.ENABLE_PAGE_DOCS = v
            const req = createRequest({
                headers: {
                    Authorization: 'Bearer my-api-key',
                },
            })
            const mockResponse = createResponse()
            const nextFunction = sinon.spy()
            await docsAreEnabled(req as Request, mockResponse, nextFunction)
            sinon.assert.calledOnceWithMatch(
                mockResponse.status as sinon.SinonStub,
                403
            )
            sinon.assert.calledOnceWithMatch(
                mockResponse.send as sinon.SinonStub,
                'Docs are disabled on this server.'
            )
            sinon.assert.notCalled(nextFunction)
        }
    })
})
