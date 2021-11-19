import gql from 'graphql-tag'

// an enum that defines status
const status = gql`
    enum Status {
        active
        inactive
    }
`

export default {
    typeDefs: status,
}
