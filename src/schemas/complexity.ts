import gql from 'graphql-tag'
import { GraphQLSchemaModule } from '../types/schemaModule'

const typeDefs = gql`
    type Complexity {
        score: Int
        limit: Int
    }

    extend type Query {
        queryComplexity: Complexity
    }
`

export const module: GraphQLSchemaModule = {
    typeDefs,
    resolvers: {
        Query: {
            queryComplexity: (_parent, _args, ctx, _info) => {
                return ctx.complexity
            },
        },
    },
}
