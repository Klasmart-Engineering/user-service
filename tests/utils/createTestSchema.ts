import { buildSubgraphSchema } from '@apollo/subgraph'
import { GraphQLResolverMap } from 'apollo-graphql'
import { GraphQLSchema } from 'graphql'
import gql from 'graphql-tag'
import { isDeprecatedLoggerTransformer } from '../../src/directives/isDeprecatedLogger'
import { GraphQLSchemaModule } from '../../src/types/schemaModule'

const myUser = {
    user_id: '123',
    first_name: 'John',
    family_name: 'Doe',
    username: 'johnnyD',
    myOrganization: {
        organization_id: '456',
    },
}

const typeDefs = gql`
    type Mutation {
        setUsername(username: String!): User
            @deprecated(reason: "Use setUserNames instead")
        setUserNames(first_name: String!, last_name: String!): User
    }

    type Query {
        getUserById(user_id: String): User
            @deprecated(reason: "Use getUser instead")
        getUser: User
    }

    type User {
        user_id: String
        first_name: String
        family_name: String
        username: String
            @deprecated(reason: "Use first_name and last_name instead")
        myOrganization: Organization @deprecated
    }

    type Organization {
        organization_id: String
        orgId: String @deprecated(reason: "Use organization_id instead")
    }
`

const resolvers: GraphQLResolverMap = {
    Mutation: {
        setUsername: (_parent, args) => {
            myUser.username = args.username
            return myUser
        },
        setUserNames: (_parent, args) => {
            myUser.first_name = args.first_name
            myUser.family_name = args.last_name
            return myUser
        },
    },
    Query: {
        getUserById: () => myUser,
        getUser: () => myUser,
    },
}

export default function createTestSchema(): GraphQLSchema {
    const module: GraphQLSchemaModule = { typeDefs, resolvers }
    let schema = buildSubgraphSchema(module)
    schema = [isDeprecatedLoggerTransformer].reduce(
        (previousSchema, transformer) => transformer(previousSchema),
        schema
    )
    return schema
}
