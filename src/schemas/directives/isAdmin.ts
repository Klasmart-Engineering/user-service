import gql from 'graphql-tag'

// isAdmin Directive
export default gql`
    directive @isAdmin(entity: String) on FIELD_DEFINITION
`
