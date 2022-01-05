import { getComplexity } from 'graphql-query-complexity'
import {
    DirectiveLocation,
    getDirectiveValues,
    GraphQLDirective,
    GraphQLField,
    GraphQLInt,
    separateOperations,
} from 'graphql'
import { MAX_PAGE_SIZE } from '../utils/pagination/paginate'
import { GraphQLRequestContext, WithRequired } from 'apollo-server-types'
import { Context } from '../main'
import { ApolloServerPlugin } from 'apollo-server-plugin-base'
import logger from '../logging'

// apollo doesn't let us supply this as a validation rule
// so run it as a plugin instead
// See https://github.com/slicknode/graphql-query-complexity/issues/7
export const complexityPlugin: ApolloServerPlugin<Context> = {
    requestDidStart: async () => {
        return {
            didResolveOperation,
        }
    },
}

// allows a single child connection with page size of 50 on both child and parent
export const DEFAULT_MAX_QUERY_COMPLEXITY = 2550

export function getMaxQueryComplexity(): number {
    const envVarName = 'MAX_QUERY_COMPLEXITY'
    const envVarValue = process.env[envVarName]
    if (typeof envVarValue === 'undefined') {
        return DEFAULT_MAX_QUERY_COMPLEXITY
    } else {
        const maxQueryComplexity = parseInt(envVarValue, 10)
        // we want to be able to reduce it in emergencies if a particular kind of request causes performance impact
        // or we get DOS'd
        // but we don't want it to be increased without discussion with our team
        if (isNaN(maxQueryComplexity) || maxQueryComplexity < 0) {
            throw Error(
                `${envVarName} environment variable must be a postive integer, was: ${envVarValue}`
            )
        } else if (
            maxQueryComplexity > DEFAULT_MAX_QUERY_COMPLEXITY &&
            process.env.NODE_ENV !== 'development'
        ) {
            throw Error(
                `${envVarName} environment variable must not be more than ${DEFAULT_MAX_QUERY_COMPLEXITY}, was: ${envVarValue}`
            )
        }
        return maxQueryComplexity
    }
}

async function didResolveOperation(
    requestContext: WithRequired<
        GraphQLRequestContext<Context>,
        'document' | 'operationName' | 'operation'
    >
): Promise<void> {
    const { schema, request, document, operationName, context } = requestContext

    const query = operationName
        ? separateOperations(document)[operationName]
        : document

    const complexity = getComplexity({
        schema,
        query,
        variables: request.variables,
        estimators: [makeComplexityEstimator()],
    })

    const maxComplexity = getMaxQueryComplexity()

    if (complexity > maxComplexity) {
        const loggingContext = {
            query: requestContext.request.query,
            origin: context.req.headers['origin'],
            maxComplexity,
            complexity,
        }
        logger.log('warn', '%o', { loggingContext })
    }

    requestContext.context.complexity = {
        limit: maxComplexity,
        score: complexity,
    }
}

function calculateNodeCount(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    directiveValues: undefined | { [key: string]: any },
    isConnectionField: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: { [key: string]: any }
) {
    if (directiveValues?.count != undefined) {
        return directiveValues.count
    }

    if (isConnectionField) {
        const directionArgCount = args.directionArgs?.count
        const count = args.count

        if (count !== undefined && directionArgCount !== undefined) {
            //todo: log the field value and type def
            throw new Error(
                '2 forms of count arguments found, not sure which to use for complexity calculation'
            )
        }

        return count ?? directionArgCount ?? MAX_PAGE_SIZE
    } else {
        return 1
    }
}

export type EstimatorComplexityArgs = {
    args: { directionArgs?: { count: number }; count?: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    field: GraphQLField<any, any>
    childComplexity: number
}

export function makeComplexityEstimator(): (
    options: EstimatorComplexityArgs
) => number {
    const directive = new GraphQLDirective({
        name: 'complexity',
        description: 'Define a relation between the field and other nodes',
        locations: [DirectiveLocation.FIELD_DEFINITION],
        args: {
            cost: {
                type: GraphQLInt,
                description: 'The complexity of each instance of the field',
            },
            count: {
                type: GraphQLInt,
                description:
                    'How many instances of the field we expect to return',
            },
        },
    })

    return ({ args, field: { args: fieldArgs, astNode }, childComplexity }) => {
        let directiveValues
        if (astNode) {
            directiveValues = getDirectiveValues(directive, astNode)
        }

        // our API contains 2 styles of connection fields
        // one which nests "count" inside "directionArgs"
        // and one which has "count" unnested
        const isConnectionField =
            fieldArgs.find(
                (arg) => arg.name == 'directionArgs' || arg.name == 'count'
            ) !== undefined
        let costComplexity: number

        if (isConnectionField) {
            costComplexity = directiveValues?.cost ?? 1
        } else {
            // by default we want fields to add 0 complexity
            // to avoid impact to existing queries
            costComplexity = directiveValues?.cost ?? 0
        }

        const nodeCount = calculateNodeCount(
            directiveValues,
            isConnectionField,
            args
        )

        const totalComplexity =
            nodeCount * costComplexity + nodeCount * childComplexity

        return totalComplexity
    }
}
