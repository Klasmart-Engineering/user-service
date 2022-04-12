import gql from 'graphql-tag'
import { GraphQLError, GraphQLScalarType } from 'graphql'
import { Kind } from 'graphql/language'
import { GraphQLSchemaModule } from '../../types/schemaModule'
import Joi from 'joi'

export const GraphQLDate = new GraphQLScalarType({
    name: 'Date',
    description: 'Datetime following the ISO-8601 format',
    serialize: (value) => {
        try {
            return value.toISOString()
        } catch (e) {
            throw new TypeError(
                `Value is not serialisable as ISO-8601 format: ${value}`
            )
        }
    },
    parseValue: (value) => {
        return parse(value)
    },
    parseLiteral: (ast) => {
        if (ast.kind !== Kind.STRING) {
            throw new GraphQLError(
                `Can only parse datetimes in string ISO-8601 format but got a: ${ast.kind}`
            )
        }

        return parse(ast.value)
    },
})

/**
 * Attempts to parse the supplied value into JS Date object
 * @param value ISO-format datetime string (YYYY-MM-DDTHH:mm:SS.xxxZ)
 * @returns JS Date object
 */
function parse(value: string): Date {
    const validation = Joi.date().iso()
    const result = validation.validate(value)
    if (result.error) {
        throw new TypeError(
            `Value is not in ISO-8601 datetime format: ${value}`
        )
    }
    return result.value
}

const resolvers = {
    Date: GraphQLDate,
}

const typeDefs = gql`
    scalar Date
`

const dateModule: GraphQLSchemaModule = {
    typeDefs,
    resolvers,
}

export default dateModule
