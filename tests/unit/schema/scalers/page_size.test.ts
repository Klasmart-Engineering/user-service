import { Kind } from 'graphql/language'

import {
    GraphQLPageSize,
    MAX_PAGE_SIZE,
    MIN_PAGE_SIZE,
} from '../../../../src/schemas/scalars/page_size'
import { GraphQLError } from 'graphql'
import { expect } from 'chai'

type Kinds = 'IntValue' | 'FloatValue' | 'StringValue'

function parseLiteralHelper(value: string, kind: Kinds = Kind.INT) {
    return GraphQLPageSize.parseLiteral({ value, kind }, {})
}

describe('PageSize', () => {
    context('is valid', () => {
        function expectIsValid(value: number) {
            expect(GraphQLPageSize.parseValue(value)).to.be.eq(value)
            expect(GraphQLPageSize.serialize(value)).to.be.eq(value)
            expect(parseLiteralHelper(value.toString())).to.be.eq(value)
        }

        it('is the lowest value', () => {
            expectIsValid(MIN_PAGE_SIZE)
        })

        it('is the highest value', () => {
            expectIsValid(MAX_PAGE_SIZE)
        })
    })
    context('is not valid', () => {
        function expectIsNotValid(value: number) {
            expect(() => GraphQLPageSize.parseValue(value)).to.throw(
                TypeError,
                `Value is not an integer between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE} (inclusive): ${value}`
            )
            expect(() => GraphQLPageSize.serialize(value)).to.throw(
                TypeError,
                `Value is not an integer between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE} (inclusive): ${value}`
            )
            expect(() => parseLiteralHelper(value.toString())).to.throw(
                TypeError,
                `Value is not an integer between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE} (inclusive): ${value}`
            )
        }
        it('is too low', () => {
            expectIsNotValid(MIN_PAGE_SIZE - 1)
        })

        it('is too high', () => {
            expectIsNotValid(MAX_PAGE_SIZE + 1)
        })
        it('is a float', () => {
            expectIsNotValid(20.5)
        })
        it('does not have an Integer AST kind', () => {
            expect(() => parseLiteralHelper('1', Kind.STRING)).to.throw(
                GraphQLError,
                'Can only validate integers but got a: StringValue'
            )
        })
    })
})
