import { expect } from 'chai'
import { GraphQLField, GraphQLObjectType } from 'graphql'
import {
    makeComplexityEstimator,
    EstimatorComplexityArgs,
    getMaxQueryComplexity,
    DEFAULT_MAX_QUERY_COMPLEXITY,
} from '../../../src/utils/complexity'
import gql from 'graphql-tag'
import complexity from '../../../src/schemas/directives/complexity'
import { buildSubgraphSchema } from '@apollo/subgraph'
import pagination from '../../../src/schemas/pagination'
import page_size from '../../../src/schemas/scalars/page_size'
import { MAX_PAGE_SIZE } from '../../../src/utils/pagination/paginate'

describe('complexity', () => {
    let estimator: (options: EstimatorComplexityArgs) => number
    const countComplexityOverride = 2
    const clientSuppliedCount = 3
    const childComplexity = 5
    const costComplexityOverride = 7

    const parseFields = (fieldDefinitions: string[]) => {
        const queryType = gql`type Query{
            ${fieldDefinitions.join('\n')}
        }
        `

        const modules = [pagination, complexity, page_size, queryType]
        const federatedSchema = buildSubgraphSchema(modules)
        const queryObject = federatedSchema.getType(
            'Query'
        ) as GraphQLObjectType
        return queryObject.getFields()
    }

    const estimateArg = (
        field: GraphQLField<any, any>,
        defaultChildComplexity = 0,
        args = {}
    ) => {
        return {
            args,
            field,
            childComplexity: defaultChildComplexity,
        }
    }

    beforeEach(() => {
        estimator = makeComplexityEstimator()
    })

    context('has directive complexity', () => {
        context('with only count value', () => {
            it('causes no change without child complexity', () => {
                const fieldDefinition = [
                    `myField: Int @complexity(count: ${countComplexityOverride})`,
                ]
                const estimatorArg = estimateArg(
                    parseFields(fieldDefinition)['myField']
                )

                expect(estimator(estimatorArg)).to.eq(0)
            })

            it('multiplies by child complexity', () => {
                const fieldDefinitions = [
                    `myField: Int @complexity(count: ${countComplexityOverride})`,
                ]
                const estimatorArg = estimateArg(
                    parseFields(fieldDefinitions)['myField'],
                    childComplexity
                )
                expect(estimator(estimatorArg)).to.eq(
                    countComplexityOverride * childComplexity
                )
            })

            it('takes precedance over count arg', () => {
                const fieldDefinitions = [
                    `myField(count: Int): Int`,
                    `myField2(count: Int): Int @complexity(count: ${countComplexityOverride})`,
                ]
                const estimatorArg = estimateArg(
                    parseFields(fieldDefinitions)['myField2'],
                    0,
                    { count: clientSuppliedCount }
                )
                expect(estimator(estimatorArg)).to.eq(countComplexityOverride)

                // do this to check the defintion without complexity
                // does not happen to accidently be the same as with complexity
                const estimatorArg2 = estimateArg(
                    parseFields(fieldDefinitions)['myField'],
                    0,
                    { count: clientSuppliedCount }
                )
                expect(estimator(estimatorArg2)).to.not.eq(
                    estimator(estimatorArg)
                )
            })
        })

        context('with only per entity value', () => {
            const fieldDefinition = [
                `myField: Int @complexity(cost: ${costComplexityOverride})`,
            ]
            let parsedFieldDef: GraphQLField<any, any>
            beforeEach(() => {
                parsedFieldDef = parseFields(fieldDefinition)['myField']
            })

            it('is used', () => {
                const estimatorArg = estimateArg(parsedFieldDef)
                expect(estimator(estimatorArg)).to.eq(costComplexityOverride)
            })

            it('adds to child complexity', () => {
                const estimatorArg = estimateArg(
                    parsedFieldDef,
                    childComplexity
                )
                expect(estimator(estimatorArg)).to.eq(
                    costComplexityOverride + childComplexity
                )
            })
        })

        context('with count and per entity values', () => {
            const fieldDefinition = [
                `myField: Int @complexity(cost: ${costComplexityOverride}, count: ${countComplexityOverride})`,
            ]
            let parsedFieldDef: GraphQLField<any, any>
            beforeEach(() => {
                parsedFieldDef = parseFields(fieldDefinition)['myField']
            })
            it('multiplies them', () => {
                const estimatorArg = estimateArg(parsedFieldDef)
                expect(estimator(estimatorArg)).to.eq(
                    costComplexityOverride * countComplexityOverride
                )
            })

            it('uses child complexity', () => {
                const estimatorArg = estimateArg(
                    parsedFieldDef,
                    childComplexity
                )
                expect(estimator(estimatorArg)).to.eq(
                    countComplexityOverride * costComplexityOverride +
                        countComplexityOverride * childComplexity
                )
            })
        })
    })

    context('on non-connection fields with no directive', () => {
        const fieldDefinition = [`myField: Int`]
        let parsedFieldDef: GraphQLField<any, any>
        beforeEach(() => {
            parsedFieldDef = parseFields(fieldDefinition)['myField']
        })
        for (const currentChildComplexity of [0, childComplexity]) {
            it(`returns their child complexity of ${currentChildComplexity} unchanged`, () => {
                const estimatorArg = estimateArg(
                    parsedFieldDef,
                    currentChildComplexity
                )
                expect(estimator(estimatorArg)).to.eq(currentChildComplexity)
            })
        }
    })

    const fieldDefinitions = new Map([
        [
            'count',
            {
                fieldDefinition: 'myField(count: Int): Int',
                args: { count: clientSuppliedCount },
            },
        ],
        [
            'directionArgsCount',
            {
                fieldDefinition:
                    'myField(directionArgs: ConnectionsDirectionArgs): Int',
                args: { directionArgs: { count: clientSuppliedCount } },
            },
        ],
    ])

    for (const [name, testParams] of fieldDefinitions.entries()) {
        context(name, () => {
            let parsedFieldDef: GraphQLField<any, any>
            beforeEach(() => {
                parsedFieldDef = parseFields([testParams.fieldDefinition])[
                    'myField'
                ]
            })
            it('uses count', () => {
                const estimatorArg = estimateArg(
                    parsedFieldDef,
                    0,
                    testParams.args
                )

                expect(estimator(estimatorArg)).to.eq(clientSuppliedCount)
            })

            it('multiplies count with child complexity', () => {
                const estimatorArg = estimateArg(
                    parsedFieldDef,
                    childComplexity,
                    testParams.args
                )
                expect(estimator(estimatorArg)).to.eq(
                    clientSuppliedCount + clientSuppliedCount * childComplexity
                )
            })

            it('uses a default count value', () => {
                const estimatorArg = estimateArg(parsedFieldDef)
                expect(estimator(estimatorArg)).to.eq(MAX_PAGE_SIZE)
            })
        })
    }

    it('throws an error if more then one form of count arguments found', () => {
        const fieldDefinition = [
            `myfield(count: Int, directionArgs: ConnectionsDirectionArgs): Int`,
        ]
        const estimatorArg = estimateArg(
            parseFields(fieldDefinition)['myfield'],
            0,
            {
                count: clientSuppliedCount,
                directionArgs: { count: clientSuppliedCount },
            }
        )

        expect(estimator.bind(null, estimatorArg)).to.throw(
            '2 forms of count arguments found, not sure which to use for complexity calculation'
        )
    })
})

describe('DEFAULT_MAX_QUERY_COMPLEXITY enviroment variable', () => {
    it('uses default value if environment variable is not set', () => {
        expect(getMaxQueryComplexity()).to.be.eq(DEFAULT_MAX_QUERY_COMPLEXITY)
    })

    it('uses environment variable value when set', () => {
        const limit = 5
        process.env.MAX_QUERY_COMPLEXITY = limit.toString()
        expect(getMaxQueryComplexity()).to.be.eq(limit)
    })

    context('environment variable value is invalid', () => {
        it('it is negative', () => {
            const limit = -1
            process.env.MAX_QUERY_COMPLEXITY = limit.toString()
            expect(getMaxQueryComplexity).to.throw(
                'MAX_QUERY_COMPLEXITY environment variable must be a postive integer, was: -1'
            )
        })
        it('it is not a number', () => {
            const limit = 'poop'
            process.env.MAX_QUERY_COMPLEXITY = limit.toString()
            expect(getMaxQueryComplexity).to.throw(
                'MAX_QUERY_COMPLEXITY environment variable must be a postive integer, was: poop'
            )
        })

        it('it is too big', () => {
            if (process.env.NODE_ENV === 'development') {
                process.env.NODE_ENV = 'overridden'
            }
            const limit = DEFAULT_MAX_QUERY_COMPLEXITY + 1
            process.env.MAX_QUERY_COMPLEXITY = limit.toString()
            expect(getMaxQueryComplexity).to.throw(
                `MAX_QUERY_COMPLEXITY environment variable must not be more than ${DEFAULT_MAX_QUERY_COMPLEXITY}, was: ${process.env.MAX_QUERY_COMPLEXITY}`
            )
            if (process.env.NODE_ENV === 'overridden') {
                process.env.NODE_ENV = 'development'
            }
        })
    })
})
