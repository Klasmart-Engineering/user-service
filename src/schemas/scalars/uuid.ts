import gql from 'graphql-tag'
import GraphQLUUID from 'graphql-type-uuid'
import { GraphQLScalarType } from 'graphql'
import { GraphQLSchemaModule } from '../../types/schemaModule'

const typeDefs = gql`
    scalar UUID

    type MyType {
        myField: UUID
    }
`

// seems like the type used by graphql-type-uuid is outdated
const _GraphQLUUID = GraphQLUUID as GraphQLScalarType

const resolvers = {
    UUID: _GraphQLUUID,
}

const uuidModule: GraphQLSchemaModule = { typeDefs, resolvers }

export default uuidModule
