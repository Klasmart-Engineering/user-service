import gql from 'graphql-tag'

// isMIMEType Directive
export default gql`
    directive @isMIMEType(mimetype: String) on FIELD_DEFINITION
`
