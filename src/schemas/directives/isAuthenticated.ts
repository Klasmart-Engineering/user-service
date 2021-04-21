import gql from 'graphql-tag'

// isAuthenticated Directive
export default gql`
    directive @isAuthenticated on FIELD_DEFINITION
`
