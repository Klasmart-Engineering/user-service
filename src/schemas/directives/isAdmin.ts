import gql from 'graphql-tag'

// isAdmin Directive
const isAdmin = gql`
    directive @isAdmin(entity: String) on FIELD_DEFINITION
`

export default {
    typeDefs: isAdmin,
}
