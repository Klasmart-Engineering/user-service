import gql from 'graphql-tag'
import { Model } from '../model'
import { Context } from '../main'
import { GraphQLSchemaModule } from '../types/schemaModule'

const typeDefs = gql`
    extend type Mutation {
        age_range(id: ID!): AgeRange @isAdmin(entity: "ageRange")
        uploadAgeRangesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }

    # pagination extension types start here
    type AgeRangesConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [AgeRangesConnectionEdge]
    }

    type AgeRangesConnectionEdge implements iConnectionEdge {
        cursor: String
        node: AgeRangeConnectionNode
    }
    # pagination extension types end here

    enum AgeRangeSortBy {
        id
        lowValue
        lowValueUnit
    }

    input AgeRangeSortInput {
        field: [AgeRangeSortBy!]!
        order: SortOrder!
    }

    input AgeRangeFilter {
        # table columns
        ageRangeValueFrom: AgeRangeValueFilter
        ageRangeUnitFrom: AgeRangeUnitFilter
        ageRangeValueTo: AgeRangeValueFilter
        ageRangeUnitTo: AgeRangeUnitFilter
        status: StringFilter
        system: BooleanFilter

        # joined columns
        organizationId: UUIDFilter
        programId: UUIDFilter

        AND: [AgeRangeFilter!]
        OR: [AgeRangeFilter!]
    }

    type AgeRangeConnectionNode {
        id: ID!
        name: String
        status: Status!
        system: Boolean!
        lowValue: Int!
        lowValueUnit: AgeRangeUnit!
        highValue: Int!
        highValueUnit: AgeRangeUnit!
    }

    extend type Query {
        age_range(id: ID!): AgeRange
            @isAdmin(entity: "ageRange")
            @deprecated(
                reason: "Sunset Date: 08/02/2022 Details: https://calmisland.atlassian.net/wiki/spaces/ATZ/pages/2427683554"
            )
        ageRangeNode(id: ID!): AgeRangeConnectionNode
            @isAdmin(entity: "ageRange")
        ageRangesConnection(
            direction: ConnectionDirection!
            directionArgs: ConnectionsDirectionArgs
            filter: AgeRangeFilter
            sort: AgeRangeSortInput
        ): AgeRangesConnectionResponse @isAdmin(entity: "ageRange")
    }

    type AgeRange {
        id: ID!
        name: String!
        low_value: Int!
        high_value: Int!
        low_value_unit: AgeRangeUnit!
        high_value_unit: AgeRangeUnit!
        system: Boolean!
        status: Status

        # Mutations
        delete(_: Int): Boolean
    }
    input AgeRangeDetail {
        id: ID
        name: String
        low_value: Int
        high_value: Int
        low_value_unit: AgeRangeUnit
        high_value_unit: AgeRangeUnit
        system: Boolean
    }
`

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            Mutation: {
                age_range: (_parent, args, ctx, _info) =>
                    model.getAgeRange(args, ctx),
                uploadAgeRangesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadAgeRangesFromCSV(args, ctx, info),
            },
            Query: {
                age_range: (_parent, args, ctx, _info) =>
                    model.getAgeRange(args, ctx),
                ageRangesConnection: (_parent, args, ctx: Context, info) =>
                    model.ageRangesConnection(ctx, info, args),
                ageRangeNode: (_parent, args, ctx: Context) => {
                    return ctx.loaders.ageRangeNode.node.instance.load(args)
                },
            },
        },
    }
}
