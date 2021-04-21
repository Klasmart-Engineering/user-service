import gql from 'graphql-tag'

// an enum that defines status
export default gql`
    enum Status {
        active
        inactive
    }
`
