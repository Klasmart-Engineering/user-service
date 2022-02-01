import {
    getWhereClauseFromFilter,
    IEntityFilter,
    filterHasProperty,
    processComposedValue,
    setOperatorInComposedValue,
    parseValueForSQLOperator,
} from '../../../../src/utils/pagination/filtering'
import { Connection, createQueryBuilder } from 'typeorm'
import { createTestConnection } from '../../../utils/testConnection'
import { expect } from 'chai'
import { AgeRangeUnit } from '../../../../src/entities/ageRangeUnit'

describe('getWhereClauseFromFilter', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    it("doesn't filter if an empty filter config is provided", () => {
        const filter: IEntityFilter = {}

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))

        expect(scope.getSql().indexOf('WHERE')).to.equal(-1)
    })

    it('works on a single field', () => {
        const filter: IEntityFilter = {
            email: {
                operator: 'eq',
                value: 'joe@gmail.com',
            },
        }

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal('WHERE ((email = $1))')
        expect(Object.keys(scope.getParameters()).length).to.equal(1)
    })

    it('works on multiple fields', () => {
        const filter: IEntityFilter = {
            email: {
                operator: 'eq',
                value: 'joe@gmail.com',
            },
            username: {
                operator: 'eq',
                value: 'joe',
            },
        }

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal('WHERE ((email = $1) AND (username = $2))')
        expect(Object.keys(scope.getParameters()).length).to.equal(2)
    })

    it('supports OR operations on different fields', () => {
        const filter: IEntityFilter = {
            OR: [
                {
                    email: {
                        operator: 'eq',
                        value: 'joe@gmail.com',
                    },
                },
                {
                    username: {
                        operator: 'eq',
                        value: 'joe',
                    },
                },
                {
                    gender: {
                        operator: 'eq',
                        value: 'female',
                    },
                },
            ],
        }

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal(
            'WHERE ((((email = $1)) OR ((username = $2)) OR ((gender = $3))))'
        )
        expect(Object.keys(scope.getParameters()).length).to.equal(3)
    })

    it('supports OR operations on the same field', () => {
        const filter: IEntityFilter = {
            OR: [
                {
                    email: {
                        operator: 'eq',
                        value: 'joe@gmail.com',
                    },
                },
                {
                    email: {
                        operator: 'eq',
                        value: 'billy@gmail.com',
                    },
                },
                {
                    email: {
                        operator: 'eq',
                        value: 'sandy@gmail.com',
                    },
                },
            ],
        }

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal(
            'WHERE ((((email = $1)) OR ((email = $2)) OR ((email = $3))))'
        )
        expect(Object.keys(scope.getParameters()).length).to.equal(3)
    })

    it('handles both fields + logical operators', () => {
        const filter: IEntityFilter = {
            email: {
                operator: 'eq',
                value: 'joe@gmail.com',
            },
            OR: [
                {
                    username: {
                        operator: 'eq',
                        value: 'joe',
                    },
                },
                {
                    gender: {
                        operator: 'eq',
                        value: 'female',
                    },
                },
            ],
        }

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal(
            'WHERE ((email = $1) AND (((username = $2)) OR ((gender = $3))))'
        )
        expect(Object.keys(scope.getParameters()).length).to.equal(3)
    })

    it('supports AND + OR combinations', () => {
        const filter: IEntityFilter = {
            AND: [
                {
                    OR: [
                        {
                            email: {
                                operator: 'eq',
                                value: 'billy@gmail.com',
                            },
                        },
                        {
                            username: {
                                operator: 'eq',
                                value: 'billy',
                            },
                        },
                    ],
                },
                {
                    OR: [
                        {
                            email: {
                                operator: 'eq',
                                value: 'joe@gmail.com',
                            },
                        },
                        {
                            username: {
                                operator: 'eq',
                                value: 'joe',
                            },
                        },
                    ],
                },
            ],
        }

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal(
            'WHERE ((((((email = $1)) OR ((username = $2)))) AND ((((email = $3)) OR ((username = $4))))))'
        )
        expect(Object.keys(scope.getParameters()).length).to.equal(4)
    })

    it('handles empty arrays', () => {
        const filter: IEntityFilter = {
            OR: [],
        }
        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))

        expect(scope.getSql().indexOf('WHERE')).to.equal(-1)
    })

    it('applies an AND operation if a single item is passed to the logical operators array', () => {
        const filter: IEntityFilter = {
            OR: [
                {
                    email: {
                        operator: 'eq',
                        value: 'joe@gmail.com',
                    },
                },
            ],
        }

        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal('WHERE ((((email = $1))))')
    })

    it("produces the correct query when using the 'contains' operator", () => {
        const filter: IEntityFilter = {
            email: {
                operator: 'contains',
                value: 'gmail',
            },
        }
        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal('WHERE ((email LIKE $1))')
        expect(Object.keys(scope.getParameters()).length).to.equal(1)
        expect(
            scope.getParameters()[Object.keys(scope.getParameters())[0]]
        ).to.equal('%gmail%')
    })

    it('supports case insensitivity', () => {
        const filter: IEntityFilter = {
            email: {
                operator: 'contains',
                value: 'GMAIL',
                caseInsensitive: true,
            },
        }
        const scope = createQueryBuilder('user')
        scope.andWhere(getWhereClauseFromFilter(filter))
        const whereClause = scope
            .getSql()
            .slice(scope.getSql().indexOf('WHERE'))

        expect(whereClause).to.equal('WHERE ((lower(email) LIKE lower($1)))')
    })

    context('column aliases', () => {
        it('supports single value alias', () => {
            const filter: IEntityFilter = {
                asd: {
                    operator: 'eq',
                    value: 'joe@gmail.com',
                },
            }

            const scope = createQueryBuilder('user')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    asd: 'email',
                })
            )
            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal('WHERE ((email = $1))')
            expect(Object.keys(scope.getParameters()).length).to.equal(1)
        })

        it("supports multiple aliases ('AND' operator)", () => {
            const filter: IEntityFilter = {
                asd: {
                    operator: 'contains',
                    value: 'joe',
                },
            }

            const scope = createQueryBuilder('user')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    asd: {
                        operator: 'AND',
                        aliases: ['email', 'username'],
                    },
                })
            )
            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal(
                'WHERE ((email LIKE $1 AND username LIKE $2))'
            )
        })

        it("supports multiple aliases ('OR' operator)", () => {
            const filter: IEntityFilter = {
                asd: {
                    operator: 'contains',
                    value: 'joe',
                },
            }

            const scope = createQueryBuilder('user')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    asd: {
                        operator: 'OR',
                        aliases: ['email', 'username'],
                    },
                })
            )
            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal(
                'WHERE ((email LIKE $1 OR username LIKE $2))'
            )
        })

        it('supports alias ignores', () => {
            const filter: IEntityFilter = {
                asd: {
                    operator: 'contains',
                    value: 'joe',
                },
            }

            const scope = createQueryBuilder('user')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    asd: '',
                })
            )
            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal('WHERE (true)')
        })
    })

    context('compound values', () => {
        it('using eq operator', () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'eq',
                    value: {
                        value: 6,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            const scope = createQueryBuilder('program')
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal(
                'WHERE ("AgeRange"."low_value" = $1 AND "AgeRange"."low_value_unit" = $2)'
            )

            expect(Object.keys(scope.getParameters()).length).to.equal(2)
        })

        it('using neq operator', () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'neq',
                    value: {
                        value: 6,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            const scope = createQueryBuilder('program')
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal('WHERE ("AgeRange"."low_value" != $1)')

            expect(Object.keys(scope.getParameters()).length).to.equal(1)
        })

        it('using gt operator', () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'gt',
                    value: {
                        value: 6,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            const scope = createQueryBuilder('program')
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal(
                'WHERE ("AgeRange"."low_value" > $1 AND "AgeRange"."low_value_unit" = $2)'
            )

            expect(Object.keys(scope.getParameters()).length).to.equal(2)
        })

        it('using gte operator', () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'gte',
                    value: {
                        value: 6,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            const scope = createQueryBuilder('program')
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal(
                'WHERE ("AgeRange"."low_value" >= $1 AND "AgeRange"."low_value_unit" = $2)'
            )

            expect(Object.keys(scope.getParameters()).length).to.equal(2)
        })

        it('using lt operator', () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'lt',
                    value: {
                        value: 6,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            const scope = createQueryBuilder('program')
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal(
                'WHERE ("AgeRange"."low_value" < $1 AND "AgeRange"."low_value_unit" = $2)'
            )

            expect(Object.keys(scope.getParameters()).length).to.equal(2)
        })

        it('using lte operator', () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'lte',
                    value: {
                        value: 6,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            const scope = createQueryBuilder('program')
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const whereClause = scope
                .getSql()
                .slice(scope.getSql().indexOf('WHERE'))

            expect(whereClause).to.equal(
                'WHERE ("AgeRange"."low_value" <= $1 AND "AgeRange"."low_value_unit" = $2)'
            )

            expect(Object.keys(scope.getParameters()).length).to.equal(2)
        })
    })
})

describe('filterRequiresJoin', () => {
    it('works for properties at the root', () => {
        expect(
            filterHasProperty('user_id', {
                user_id: { operator: 'eq', value: '123' },
            })
        ).be.equal(true)
        expect(
            filterHasProperty('username', {
                user_id: { operator: 'eq', value: '123' },
            })
        ).be.equal(false)
    })

    it('works for nested properties', () => {
        expect(
            filterHasProperty('user_id', {
                OR: [
                    { user_id: { operator: 'eq', value: 'abc' } },
                    { username: { operator: 'eq', value: '123' } },
                ],
            })
        ).to.equal(true)

        expect(
            filterHasProperty('age', {
                OR: [
                    { user_id: { operator: 'eq', value: 'abc' } },
                    { username: { operator: 'eq', value: '123' } },
                ],
            })
        ).to.equal(false)
    })
})

describe('processComposedValue', () => {
    it('returns value from composedValue', () => {
        const alias = 'AgeRange.low_value'
        const composedValue = {
            value: 6,
            unit: AgeRangeUnit.YEAR,
        }

        const result = processComposedValue(composedValue, alias)

        expect(result).to.equal(composedValue.value)
    })

    it('returns unit from composedValue', () => {
        const alias = 'AgeRange.low_value_unit'
        const composedValue = {
            value: 6,
            unit: AgeRangeUnit.YEAR,
        }

        const result = processComposedValue(composedValue, alias)

        expect(result).to.equal(composedValue.unit)
    })

    it('returns composedValue', () => {
        const alias = 'AgeRange.status'
        const composedValue = {
            value: 6,
            unit: AgeRangeUnit.YEAR,
        }

        const result = processComposedValue(composedValue, alias)

        expect(result).to.deep.equal(composedValue)
    })
})

describe('setOperatorInComposedValue', () => {
    it('returns eq', () => {
        const alias = 'AgeRange.low_value_unit'
        const operator = 'gte'

        const result = setOperatorInComposedValue(operator, alias)

        expect(result).to.equal('eq')
    })

    it('returns operator', () => {
        const alias = 'AgeRange.low_value'
        const operator = 'gte'

        const result = setOperatorInComposedValue(operator, alias)

        expect(result).to.equal(operator)
    })
})

describe('parseValueForSQLOperator', () => {
    it('correctly escapes "%" and "_" characters for a LIKE operator.', () => {
        const value = 'test_email%test@test.com'
        const escaped = '%test\\_email\\%test@test.com%'
        const result = parseValueForSQLOperator('LIKE', value)

        expect(result).to.equal(escaped)
    })
})
