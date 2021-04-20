import gql from 'graphql-tag'

// depricated Directive
export default gql`
    directive @deprecated(
        reason: String = "No longer supported"
    ) on FIELD_DEFINITION
`
