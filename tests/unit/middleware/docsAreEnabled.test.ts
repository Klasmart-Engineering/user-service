import { Request, Response } from 'express'
import sinon from 'sinon'
import { docsAreEnabled } from '../../../src/app'

describe('docsAreEnabled middleware', () => {
    function createResponse() {
        const resp: Partial<Response> = {}
        resp.status = sinon.stub().returns(resp)
        resp.send = sinon.stub().returns(resp)
        return resp as Response
    }

    it('passes in "development" environments', () => {
        process.env.NODE_ENV = 'development'

        const mockResponse = createResponse()
        const nextFunction = sinon.spy()
        docsAreEnabled({} as Request, mockResponse, nextFunction)
        sinon.assert.calledOnce(nextFunction)
    })

    it('blocks in non-"development" environments', () => {
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

            const mockResponse = createResponse()
            const nextFunction = sinon.spy()
            docsAreEnabled({} as Request, mockResponse, nextFunction)
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

    it('passes when ENABLE_PAGE_DOCS === "1"', async () => {
        process.env.ENABLE_PAGE_DOCS = '1'

        const mockResponse = createResponse()
        const nextFunction = sinon.spy()
        docsAreEnabled({} as Request, mockResponse, nextFunction)
        sinon.assert.calledOnce(nextFunction)
    })

    it('blocks when ENABLE_PAGE_DOCS != "1"', async () => {
        const values = ['0', 'false', '', undefined, '2', 'true', 'on']
        for (const v of values) {
            process.env.ENABLE_PAGE_DOCS = v

            const mockResponse = createResponse()
            const nextFunction = sinon.spy()
            docsAreEnabled({} as Request, mockResponse, nextFunction)
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
