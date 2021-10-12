import { expect } from 'chai'
import cuid from 'cuid'
import { NextFunction, Request, Response } from 'express'
import { createRequest, createResponse } from 'node-mocks-http'
import Sinon from 'sinon'
import logger from '../../../src/logging'
import { loggerMiddlewareFactory } from '../../../src/middlewares'

context('middlewares.logger', () => {
    let loggerMiddleware: (
        req: Request,
        res: Response,
        next: NextFunction
    ) => void

    before(() => {
        loggerMiddleware = loggerMiddlewareFactory(logger)
    })

    it('sets the `logger` property on the Request object', () => {
        const request = createRequest()
        // Child logger creation expects a `correlationId` on the request object
        const id = cuid()
        request.correlationId = id

        loggerMiddleware(request, createResponse(), Sinon.fake())

        const log = request.logger
        expect(log).to.be.instanceOf(Object)
        expect(log.info).to.be.instanceOf(Function)
        expect(log.bindings()).to.deep.equal({ correlationId: id })
    })
})
