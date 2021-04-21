import gql from 'graphql-tag'

// an enum that defines age-ranges
export default gql`
    enum AgeRangeUnit {
        year
        month
    }
`
