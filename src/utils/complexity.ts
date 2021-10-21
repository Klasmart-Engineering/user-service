import {
    ComplexityEstimator,
    getComplexity,
    ComplexityEstimatorArgs,
    createComplexityDirective,
} from 'graphql-query-complexity'
import {
    DocumentNode,
    getDirectiveValues,
    GraphQLError,
    GraphQLSchema,
    separateOperations,
} from 'graphql'
import { PluginDefinition } from 'apollo-server-core'
import { MAX_PAGE_SIZE } from '../schemas/scalars/page_size'

// based on https://github.com/MichalLytek/type-graphql/blob/4501867fffe3e6f5b3e71af0b71651efcd48d9c3/examples/query-complexity/index.ts#L16-L64
// from https://github.com/slicknode/graphql-query-complexity/issues/7
// apollo doesn't let us supply this as a validation rule
// so run it as a plugin instead
export const createComplexityPlugin = ({
    schema,
    maximumComplexity,
    estimators,
    onComplete,
    createError = (max, actual) => {
        throw new GraphQLError(
            `Query too complex. Value of ${actual} is over the maximum ${max}.`
        )
    },
}: {
    schema: GraphQLSchema
    maximumComplexity: number
    estimators: Array<ComplexityEstimator>
    onComplete?: (complexity: number) => void
    createError?: (max: number, actual: number) => GraphQLError
}): PluginDefinition => {
    return {
        requestDidStart: () =>
            new Promise((resolve, reject) => {
                return resolve({
                    didResolveOperation: ({
                        request,
                        document,
                    }: {
                        request: any
                        document: DocumentNode
                    }) => {
                        return new Promise<void>((resolve, reject) => {
                            const query = request.operationName
                                ? separateOperations(document)[
                                      request.operationName
                                  ]
                                : document

                            const complexity = getComplexity({
                                schema,
                                query,
                                variables: request.variables,
                                estimators,
                            })

                            if (complexity >= maximumComplexity) {
                                console.log(complexity)
                                createError(maximumComplexity, complexity)
                            }
                            if (onComplete) {
                                onComplete(complexity)
                            }
                            resolve()
                        })
                    },
                })
            }),
    }
}

// for more on estiamtors (and other examples)
// see https://github.com/slicknode/graphql-query-complexity#configuration--complexity-estimators
// the estimator is called for every field in a query
export function makeComplexityEstimator(): ComplexityEstimator {
    const directive = createComplexityDirective({ name: 'complexity' })

    return (args: ComplexityEstimatorArgs): number | void => {
        let values
        if (args.field.astNode) {
            values = getDirectiveValues(directive, args.field.astNode)
        }

        const paginationCount = args.args?.directionArgs?.count ?? MAX_PAGE_SIZE
        const isConnectionField = args.field.args.reduce(
            (previous_value, current_value) => {
                return (
                    previous_value ||
                    // top-level connections
                    current_value.name == 'directionArgs' ||
                    // nested connections
                    current_value.name == 'count'
                )
            },
            false
        )
        let node_complexity: number
        // directive complexity takes precendance over pagination complexity
        if (values?.value) {
            node_complexity = values?.value
        } else if (isConnectionField) {
            node_complexity = paginationCount
        } else {
            // if it's not a connection field and doesn't have a directive complexity
            // then assume the current node adds no cost to its children
            return args.childComplexity
        }

        const perEntityComplexity = 1
        const totalComplexity =
            node_complexity * perEntityComplexity +
            node_complexity * args.childComplexity

        return totalComplexity
    }
}
