import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'
import { Context } from '../main'

const typeDefs = gql`
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

    enum StringOperator {
        contains
        eq
        neq
    }

    enum UUIDOperator {
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
    context?: Context
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
    }
}
