import {
    ComplexityEstimator,
    getComplexity,
    ComplexityEstimatorArgs,
    createComplexityDirective,
} from 'graphql-query-complexity'
import {
    ArgumentNode,
    DefinitionNode,
    DirectiveLocation,
    DocumentNode,
    getDirectiveValues,
    getNamedType,
    GraphQLDirective,
    GraphQLError,
    GraphQLInputField,
    GraphQLInputObjectType,
    GraphQLInt,
    GraphQLNonNull,
    GraphQLSchema,
    ObjectFieldNode,
    ObjectValueNode,
    separateOperations,
    TypeInfo,
    ValidationContext,
} from 'graphql'
import { MAX_PAGE_SIZE } from '../schemas/scalars/page_size'
import { PluginDefinition } from 'apollo-server-core'
import depthLimit from 'graphql-depth-limit'

// graphql-depth-limit does not allow custom depths for mutations
// so we wrap it in a plugin and call it manually when we see a mutation
// todo: if dataloaders work on mutation responses - do we need this?
// we also need the plugin for checking top-level operation width
// as I haven't found a package that does that
export const createMutationValidationPlugin = ({
    schema,
}: {
    schema: GraphQLSchema
}): PluginDefinition => {
    return {
        requestDidStart: () =>
            new Promise((resolve, reject) => {
                return resolve({
                    didResolveOperation: ({
                        request,
                        document,
                    }: {
                        // todo: what is this type meant to be?
                        request: any
                        document: DocumentNode
                    }) => {
                        return new Promise<void>((resolve, reject) => {
                            const query = <DocumentNode>(
                                (request.operationName
                                    ? separateOperations(document)[
                                          request.operationName
                                      ]
                                    : document)
                            )

                            // checking depth

                            const mutations = query.definitions?.find(
                                (def: DefinitionNode) => {
                                    if (def.kind == 'OperationDefinition') {
                                        return def.operation === 'mutation'
                                    } else {
                                        return false
                                    }
                                }
                            )
                            // if there are no mutations, skip the validation logic
                            // todo: this breaks if you pass mutations AND queries in the same document
                            // and don't pick one to execute (used for validating a document but not executing anything)
                            // "breaks" here means - validates the queries as if they were mutations
                            // I'm not sure it's possible to fix this without breakiing open the graphql-depth-limit package
                            // todo: could we construct a new "query" with the query definitions stripped out and pass that in?
                            if (mutations !== undefined) {
                                const typeInfo = new TypeInfo(schema)
                                const context = new ValidationContext(
                                    schema,
                                    query,
                                    typeInfo,
                                    (err) => {
                                        throw err
                                    }
                                )
                                context.getDocument()
                                depthLimit(1)(context)
                            }

                            // checking the size of top level selection sets in operations
                            for (const definition of query.definitions) {
                                if (definition.kind == 'OperationDefinition') {
                                    const selectionSetLength =
                                        definition.selectionSet.selections
                                            .length
                                    const mutationMax = 5
                                    const queryMax = 6
                                    if (
                                        definition.operation === 'mutation' &&
                                        selectionSetLength > mutationMax
                                    ) {
                                        throw new GraphQLError(
                                            `Too many top-level fields for mutation operation, found ${selectionSetLength}, must be less then ${mutationMax}`
                                        )
                                    } else if (
                                        definition.operation === 'query' &&
                                        selectionSetLength > queryMax
                                    ) {
                                        throw new GraphQLError(
                                            `Too many top-level fields for query operation, found ${selectionSetLength}, must be less then ${queryMax}`
                                        )
                                    }
                                }
                            }

                            resolve()
                        })
                    },
                })
            }),
    }
}

// based on https://github.com/MichalLytek/type-graphql/blob/4501867fffe3e6f5b3e71af0b71651efcd48d9c3/examples/query-complexity/index.ts#L16-L64
// from https://github.com/slicknode/graphql-query-complexity/issues/7
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

export function createInputComplexityDirective(): GraphQLDirective {
    return new GraphQLDirective({
        name: 'inputComplexity',
        description: 'Define cost of filtering on this input field',
        locations: [DirectiveLocation.INPUT_FIELD_DEFINITION],
        args: {
            value: {
                type: new GraphQLNonNull(GraphQLInt),
                description: 'The complexity value for the input field',
            },
        },
    })
}

function filterComplexity(args: ComplexityEstimatorArgs) {
    let filterCost = 0

    if (!args.node.arguments) {
        return filterCost
    }

    const directive = createInputComplexityDirective()
    for (const argumentNode of args.node.arguments) {
        // todo: is there a way do get a map of args fields by name?
        // so we can avoid iterating
        const argumentField = args.field.args.filter((arg) => {
            return arg.name === argumentNode.name.value
        })[0]
        const directiveValue = getDirectiveValues(
            directive,
            argumentField.astNode!
        )
        filterCost += directiveValue?.value ?? 0
        filterCost += parseNestedValue(argumentNode, argumentField)
    }
    return filterCost || 1
}

function parseNestedValue(
    field: ObjectFieldNode | ArgumentNode,
    fieldType: GraphQLInputField
) {
    const nestedObjectNodeValues: ObjectValueNode[] = []
    let nestedType: GraphQLInputObjectType
    if (field.value.kind == 'ListValue') {
        for (const value of field.value.values) {
            if (value.kind == 'ObjectValue') {
                const c = getNamedType(fieldType.type)
                // todo: check for directives on c
                if (c instanceof GraphQLInputObjectType) {
                    nestedObjectNodeValues.push(value)
                    nestedType = c
                } else {
                    // todo: what if it's a list? recurse more?
                    // for primitives we don't need to recurse, so return
                    return 0
                }
            }
        }
    } else if (field.value.kind == 'ObjectValue') {
        const c = getNamedType(fieldType.type)
        // todo: check for directives on c
        if (c instanceof GraphQLInputObjectType) {
            nestedObjectNodeValues.push(field.value)
            nestedType = c
        } else {
            // todo: what if it's a list? recurse more?
            // for primitives we don't need to recurse, so return
            return 0
        }
    }
    let total = 0
    for (const node of nestedObjectNodeValues) {
        const directive = createInputComplexityDirective()
        const typeFields = nestedType!.getFields()
        for (const nodeChildField of node.fields) {
            const typeChildField = typeFields[nodeChildField.name.value]
            const directiveValue = getDirectiveValues(
                directive,
                typeChildField.astNode!
            )
            total += directiveValue?.value ?? 0
            total += parseNestedValue(nodeChildField, typeChildField)
        }
    }
    return total
}

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
            node_complexity * perEntityComplexity * filterComplexity(args) +
            node_complexity * args.childComplexity

        return totalComplexity
    }
}
