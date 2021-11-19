import gql from 'graphql-tag'

// isMIMEType Directive
const isMIMEType = gql`
    directive @isMIMEType(mimetype: String!) on FIELD_DEFINITION
`

export default {
    typeDefs: isMIMEType,
}
