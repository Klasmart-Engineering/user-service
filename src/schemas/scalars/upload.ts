import gql from 'graphql-tag'

const typeDefs = gql`
    scalar Upload
`

export default {
    typeDefs: [typeDefs],
}
