import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    input StringFilter {
        operator: StringOperator
        value: String
    }

    input NumberFilter {
        operator: NumberOrDateOperator
        value: Float
    }

    input BooleanFilter {
        operator: BooleanOperator
        value: Boolean
    }

    input DateFilter {
        operator: NumberOrDateOperator
        value: String # YYYY-MM-DD
    }

    enum StringOperator {
        contains
        eq
        neq
    }

    enum NumberOrDateOperator {
        eq
        neq
        gt
        gte
        lt
        lte
    }

    enum BooleanOperator {
        eq
    }
`
export default function getDefault(
    model: Model,
    context?: any
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
    }
}
