import { Kind } from 'graphql/language'
import { GraphQLDate } from '../../../../src/schemas/scalars/date'
import { GraphQLError } from 'graphql'
import { expect } from 'chai'

type Kinds = 'IntValue' | 'FloatValue' | 'StringValue'

function parseLiteralHelper(value: string, kind: Kinds = Kind.STRING) {
    return GraphQLDate.parseLiteral({ value, kind }, {})
}

describe('Date', () => {
    const dateStringISO = '2020-01-01T20:10:00.333Z'
    const dateStringWithTimeZoneOffset = '2020-01-01T20:10:00.333+01:00'

    context('.serialize', () => {
        it('serialises JS Date objects', () => {
            expect(GraphQLDate.serialize(new Date(dateStringISO))).to.deep.eq(
                dateStringISO
            )
            expect(
                GraphQLDate.serialize(new Date(dateStringWithTimeZoneOffset))
            ).to.deep.eq('2020-01-01T19:10:00.333Z')
        })
        it('cannot serialise non-JS Date objects', () => {
            expect(() => GraphQLDate.serialize('2020-01-01')).to.throw(
                TypeError,
                `Value is not serialisable as ISO-8601 format: 2020-01-01`
            )
        })
    })

    context('.parseValue', () => {
        it('parses ISO datetime strings', () => {
            expect(GraphQLDate.parseValue(dateStringISO)).to.deep.eq(
                new Date(dateStringISO)
            )
        })
        it('cannot parse non-strings', () => {
            expect(() => GraphQLDate.parseValue(42)).to.throw(
                TypeError,
                `Value is not in ISO-8601 datetime format: 42`
            )
        })
    })

    context('.parseLiteralHelper', () => {
        it('does not have an Integer AST kind', () => {
            expect(() => parseLiteralHelper('1', Kind.INT)).to.throw(
                GraphQLError,
                'Can only parse datetimes in string ISO-8601 format but got a: IntValue'
            )
        })
    })
})
