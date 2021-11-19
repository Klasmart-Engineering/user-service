import gql from 'graphql-tag'

// an enum that defines age-ranges
const ageRangeUnit = gql`
    enum AgeRangeUnit {
        year
        month
    }
`

export default {
    typeDefs: ageRangeUnit,
}
