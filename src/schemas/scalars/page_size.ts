import { GraphQLScalarType } from 'graphql'
import { Kind } from 'graphql/language'
import { GraphQLError } from 'graphql'
import Joi from 'joi'
import gql from 'graphql-tag'
import { MAX_PAGE_SIZE } from '../../utils/pagination/paginate'

export const GraphQLPageSize = new GraphQLScalarType({
    name: 'PageSize',
    description: 'The number of results to return per page',
    serialize: (value) => {
        return parse(value)
    },
    parseValue: (value) => {
        return parse(value)
    },
    parseLiteral: (ast) => {
        if (ast.kind !== Kind.INT) {
            throw new GraphQLError(
                `Can only validate integers but got a: ${ast.kind}`
            )
        }

        return parse(ast.value)
    },
})

export const MIN_PAGE_SIZE = 1

function parse(value: string | number): number {
    const validation = Joi.number()
        .integer()
        .min(MIN_PAGE_SIZE)
        .max(MAX_PAGE_SIZE)
    const result = validation.validate(value)
    if (result.error) {
        throw new TypeError(
            `Value is not an integer between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE} (inclusive): ${value}`
        )
    }
    return result.value
}

const resolvers = {
    PageSize: GraphQLPageSize,
}

const typeDefs = gql`
    scalar PageSize
`

export default { typeDefs: [typeDefs], resolvers }
