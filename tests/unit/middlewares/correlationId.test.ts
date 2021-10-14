import express from 'express'
import { correlationIdMiddleware } from '../../../src/middlewares'
import { createResponse, createRequest, MockResponse } from 'node-mocks-http'
import Sinon from 'sinon'
import { expect } from 'chai'
import cuid, { isCuid } from 'cuid'

context('middlewares.correlationId', () => {
    let response: MockResponse<express.Response>
    let next: Sinon.SinonSpy

    beforeEach(() => {
        response = createResponse()
        next = Sinon.fake()
    })
    it('sets the `correlationId` property on the Request object and Response header', () => {
        const request = createRequest()

        correlationIdMiddleware(request, response, next)

        const id = request.correlationId
        expect(id).to.be.a.string
        expect(isCuid(id)).to.be.true
        expect(response.header('correlation-id')).to.equal(id)
        expect(next.calledOnce).to.be.true
    })

    it('uses the `correlation-id` Request header to set the `correlationId` property on the Request object and Response header', () => {
        const id = cuid()
        const request = createRequest({ headers: { 'correlation-id': id } })

        correlationIdMiddleware(request, response, next)

        expect(request.correlationId).to.equal(id)
        expect(response.header('correlation-id')).to.equal(id)
        expect(next.calledOnce).to.be.true
    })
})
