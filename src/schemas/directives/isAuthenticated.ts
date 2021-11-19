import gql from 'graphql-tag'

// isAuthenticated Directive
const isAuthenticated = gql`
    directive @isAuthenticated on FIELD_DEFINITION
`

export default {
    typeDefs: isAuthenticated,
}
