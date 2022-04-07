import gql from 'graphql-tag'
import { CreateAcademicTerms } from '../resolvers/academicTerm'
import { GraphQLSchemaModule } from '../types/schemaModule'
import { mutate } from '../utils/mutations/commonStructure'

const typeDefs = gql`
    extend type Mutation {
        createAcademicTerms(
            input: [CreateAcademicTermInput!]!
        ): AcademicTermsMutationResult
    }

    type AcademicTermConnectionNode {
        id: ID!
        name: String!
        startDate: Date!
        endDate: Date!
        status: Status!
    }

    input CreateAcademicTermInput {
        schoolId: ID!
        name: String!
        startDate: Date!
        endDate: Date!
    }

    type AcademicTermsMutationResult {
        academicTerms: [AcademicTermConnectionNode!]!
    }
`

export default function getDefault(): GraphQLSchemaModule {
    return {
        typeDefs,
        resolvers: {
            Mutation: {
                createAcademicTerms: (_parent, args, ctx) =>
                    mutate(CreateAcademicTerms, args, ctx.permissions),
            },
        },
    }
}
