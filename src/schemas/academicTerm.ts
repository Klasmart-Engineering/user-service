import gql from 'graphql-tag'
import { SelectQueryBuilder } from 'typeorm'
import { School } from '../entities/school'
import { Context } from '../main'
import {
    CreateAcademicTerms,
    DeleteAcademicTerms,
} from '../resolvers/academicTerm'
import { AcademicTermConnectionNode } from '../types/graphQL/academicTerm'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { mutate } from '../utils/resolvers/commonStructure'

const typeDefs = gql`
    extend type Mutation {
        createAcademicTerms(
            input: [CreateAcademicTermInput!]!
        ): AcademicTermsMutationResult
        deleteAcademicTerms(
            input: [DeleteAcademicTermInput!]!
        ): AcademicTermsMutationResult
    }

    type AcademicTermConnectionNode {
        id: ID!
        name: String!
        startDate: Date!
        endDate: Date!
        status: Status!
        school: SchoolConnectionNode! @isAdmin(entity: "school")
    }

    input CreateAcademicTermInput {
        schoolId: ID!
        name: String!
        startDate: Date!
        endDate: Date!
    }
    input DeleteAcademicTermInput {
        id: ID!
    }

    type AcademicTermsMutationResult {
        academicTerms: [AcademicTermConnectionNode!]!
    }

    # pagination extension types start here
    type AcademicTermsConnectionResponse implements iConnectionResponse {
        totalCount: Int
        pageInfo: ConnectionPageInfo
        edges: [AcademicTermsConnectionEdge]
    }

    type AcademicTermsConnectionEdge implements iConnectionEdge {
        cursor: String
        node: AcademicTermConnectionNode
    }

    enum AcademicTermSortBy {
        id
        name
        startDate
        endDate
    }

    input AcademicTermSortInput {
        field: [AcademicTermSortBy!]!
        order: SortOrder!
    }

    input AcademicTermFilter {
        # Simple filters are supported

        id: UUIDFilter
        status: StringFilter
        name: StringFilter

        # // todo: filter on start/end dates and class ID?

        AND: [AcademicTermFilter]
        OR: [AcademicTermFilter]
    }

    # pagination extension types end here
`

export default function getDefault(): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            Mutation: {
                createAcademicTerms: (_parent, args, ctx) =>
                    mutate(CreateAcademicTerms, args, ctx.permissions),
                deleteAcademicTerms: (_parent, args, ctx) =>
                    mutate(DeleteAcademicTerms, args, ctx.permissions),
            },
            AcademicTermConnectionNode: {
                school: async (
                    parent: AcademicTermConnectionNode,
                    args: { scope: SelectQueryBuilder<School> },
                    ctx: Context
                ) => {
                    return ctx.loaders.schoolNode.instance.load({
                        id: parent.schoolId,
                        scope: args.scope,
                    })
                },
            },
        },
    }
}
