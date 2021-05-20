import gql from 'graphql-tag'
import GraphQLUUID from 'graphql-type-uuid'

const typeDefs = gql`
    scalar UUID

    type MyType {
        myField: UUID
    }
`

const resolvers = {
    UUID: GraphQLUUID,
}

export default { typeDefs: [typeDefs], resolvers }
