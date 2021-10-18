import { expect } from 'chai'
import {
    maxQueryDepth,
    DEFAULT_MAX_QUERY_DEPTH,
} from '../../../src/utils/createServer'

describe('.maxQueryDepth', () => {
    it('uses default value if environment variable is not set', () => {
        expect(maxQueryDepth()).to.be.eq(DEFAULT_MAX_QUERY_DEPTH)
    })

    it('uses environment variable value when set', () => {
        const depthLimit = 5
        process.env.MAX_QUERY_DEPTH = depthLimit.toString()
        expect(maxQueryDepth()).to.be.eq(depthLimit)
    })

    context('environment variable value is invalid', () => {
        it('it is negative', () => {
            const depthLimit = -1
            process.env.MAX_QUERY_DEPTH = depthLimit.toString()
            expect(maxQueryDepth).to.throw(
                'MAX_QUERY_DEPTH environment variable must be a postive integer, was: -1'
            )
        })
        it('it is not a number', () => {
            const depthLimit = 'poop'
            process.env.MAX_QUERY_DEPTH = depthLimit.toString()
            expect(maxQueryDepth).to.throw(
                'MAX_QUERY_DEPTH environment variable must be a postive integer, was: poop'
            )
        })

        it('it is too big', () => {
            const depthLimit = DEFAULT_MAX_QUERY_DEPTH + 1
            process.env.MAX_QUERY_DEPTH = depthLimit.toString()
            expect(maxQueryDepth).to.throw(
                `MAX_QUERY_DEPTH environment variable must not be more than ${DEFAULT_MAX_QUERY_DEPTH}, was: ${process.env['MAX_QUERY_DEPTH']}`
            )
        })
    })
})
