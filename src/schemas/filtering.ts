import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'

const typeDefs = gql`
    # Filter Types
    input StringFilter {
        operator: StringOperator!
        value: String!
        caseInsensitive: Boolean
    }

    input NumberFilter {
        operator: NumberOrDateOperator!
        value: Float!
    }

    input UUIDFilter {
        operator: UUIDOperator!
        value: UUID!
    }

    input BooleanFilter {
        operator: BooleanOperator!
        value: Boolean!
    }

    input DateFilter {
        operator: NumberOrDateOperator!
        value: String! # YYYY-MM-DD
    }

    input AgeRangeTypeFilter {
        operator: NumberOrDateOperator!
        value: AgeRangeValue!
    }

    input AgeRangeUnitFilter {
        operator: UUIDOperator!
        value: AgeRangeUnit!
    }

    input AgeRangeValueFilter {
        operator: NumberOrDateOperator!
        value: Int!
    }

    input StringArrayFilter {
        operator: ArrayOperator!
        value: [String!]
    }

    # Operators and Values Types
    input AgeRangeValue {
        value: Int!
        unit: AgeRangeUnit!
    }

    enum StringOperator {
        contains
        eq
        neq
    }

    enum UUIDOperator {
        eq
        neq
        ex
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

    enum ArrayOperator {
        in
        nin
    }
`
export default function getDefault(
    model: Model,
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
    }
}
