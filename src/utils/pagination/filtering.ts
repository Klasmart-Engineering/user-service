import { Brackets } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'

export interface IEntityFilter {
    [key: string]: IFilter | IEntityFilter[] | undefined

    OR?: IEntityFilter[]
    AND?: IEntityFilter[]
}

type FilteringOperator =
    | 'eq'
    | 'neq'
    | 'lt'
    | 'lte'
    | 'gt'
    | 'gte'
    | 'contains'
    | 'isNull'
    | 'in'

interface IFilter {
    operator: FilteringOperator
    value?: FilteringValue
    caseInsensitive?: boolean
}

interface IMultipleColumn {
    aliases: string[]
    operator: 'AND' | 'OR'
}

type ColumnAliasValue = string | IMultipleColumn
type CommonValue = string | number | boolean | string[]
type ComposedValue = Record<string, CommonValue>
type FilteringValue = CommonValue | ComposedValue
type ColumnAliases = Record<string, ColumnAliasValue> // use empty string to ignore

const FILTER_VALUE_MAX_LENGTH = 250

// these aliases won't be used to filter if neq operator is applied
const AVOID_NOT_EQUAL_OPERATOR_ALIASES = [
    'AgeRange.low_value_unit',
    'AgeRange.high_value_unit',
]

// Brackets to be used when in age ranges join you want to exclude the 'None Specified' one
export const AVOID_NONE_SPECIFIED_BRACKETS = new Brackets((qb) => {
    qb.where(
        new Brackets((whereExpession) => {
            // Get all the system age ranges except the 'None Specified' one
            whereExpession
                .where('AgeRange.name != :noneSpecified', {
                    noneSpecified: 'None Specified',
                })
                .andWhere('AgeRange.system = :truthyValue', {
                    truthyValue: true,
                })
        })
        // Get all the non system age ranges
    ).orWhere('AgeRange.system = :falseyValue', {
        falseyValue: false,
    })
})

// generates a WHERE clause for a given query filter
export function getWhereClauseFromFilter(
    filter: IEntityFilter,
    columnAliases?: ColumnAliases
): Brackets {
    return new Brackets((qb) => {
        for (const key of Object.keys(filter)) {
            if (key === 'OR' || key === 'AND') {
                // process these recursively afterwards
                continue
            }

            const data = filter[key] as IFilter

            // string type values have a length limit
            if (
                typeof data.value === 'string' &&
                data.value.length > FILTER_VALUE_MAX_LENGTH
            ) {
                throw new Error(
                    `Value for provided "${key}" filter is too long. Max length allowed is ${FILTER_VALUE_MAX_LENGTH} characters`
                )
            }

            // rule: all string contains the empty string
            if (data.operator === 'contains' && data.value === '') {
                qb.andWhere('true') // avoid returning empty brackets
                continue
            }

            // check if there are multiple aliases for a single field
            // to be queried
            let aliases: string[] = [parseField(key)]
            const columnAliasValue: ColumnAliasValue | undefined =
                columnAliases?.[key]

            if (columnAliasValue !== undefined) {
                if ((columnAliasValue as string).length === 0) {
                    qb.andWhere('true')
                    continue // avoid returning empty brackets
                }

                if (
                    (columnAliasValue as IMultipleColumn).aliases?.length === 0
                ) {
                    throw new Error('Aliases array must not be empty')
                }

                aliases = (columnAliasValue as IMultipleColumn).aliases || [
                    columnAliasValue,
                ]
            }

            // a value of type object is considered as a compound value
            // deprecated, just common type values will be allowed
            if (typeof data.value === 'object' && !Array.isArray(data.value)) {
                for (const alias of aliases) {
                    let currentOperator = data.operator
                    let currentValue: FilteringValue = data.value

                    // in a neq opeartion is necessary check if is correct to check the current alias
                    if (
                        data.operator === 'neq' &&
                        AVOID_NOT_EQUAL_OPERATOR_ALIASES.includes(alias)
                    ) {
                        continue
                    }

                    // resetting value and operator to work properly with the given compound value
                    currentValue = processComposedValue(
                        currentValue,
                        alias
                    ) as CommonValue

                    currentOperator = setOperatorInComposedValue(
                        currentOperator,
                        alias
                    )

                    const sqlOperator = getSQLOperatorFromFilterOperator(
                        currentOperator
                    )

                    const value = parseValueForSQLOperator(
                        sqlOperator,
                        currentValue
                    )

                    // parameter keys must be unique when using typeorm querybuilder
                    const uniqueId = uuid_v4()
                    const whereCondition = createWhereCondition(
                        !!data.caseInsensitive,
                        alias,
                        sqlOperator,
                        uniqueId
                    )

                    qb.andWhere(whereCondition, {
                        [uniqueId]: value,
                    })
                }
            } else {
                // value has a common type (string | number | boolean)
                const sqlOperator = getSQLOperatorFromFilterOperator(
                    data.operator
                )

                const value = parseValueForSQLOperator(sqlOperator, data.value)

                // adding main condition for this filter
                qb.andWhere(
                    new Brackets((queryBuilder) => {
                        // adding the first condition inside main condition
                        let uniqueId = uuid_v4()
                        let whereCondition = createWhereCondition(
                            !!data.caseInsensitive,
                            aliases[0],
                            sqlOperator,
                            uniqueId
                        )

                        queryBuilder.where(whereCondition, {
                            [uniqueId]: value,
                        })

                        for (let i = 1; i < aliases.length; i += 1) {
                            let operator = (columnAliasValue as IMultipleColumn)
                                .operator
                            // Always enforce an AND operation when using the isNull operator
                            // Currently only required for the classId filter of userConnection to
                            // check for classes studying AND teaching
                            if (data.operator === 'isNull') {
                                operator = 'AND'
                            }
                            uniqueId = uuid_v4()
                            whereCondition = createWhereCondition(
                                !!data.caseInsensitive,
                                aliases[i],
                                sqlOperator,
                                uniqueId
                            )

                            if (operator === 'AND') {
                                // conditions will be joined by 'AND' operators
                                queryBuilder.andWhere(whereCondition, {
                                    [uniqueId]: value,
                                })
                            } else {
                                // conditions will be joined by 'OR' operators
                                queryBuilder.orWhere(whereCondition, {
                                    [uniqueId]: value,
                                })
                            }
                        }
                    })
                )
            }
        }

        if (filter.OR) {
            qb.andWhere(logicalOperationFilter(filter.OR, 'OR', columnAliases))
        }
        if (filter.AND) {
            qb.andWhere(
                logicalOperationFilter(filter.AND, 'AND', columnAliases)
            )
        }
    })
}

// returns true if the specified property is anywhere in the filter schema.
// used to check for entity relations that require SQL joins.
export function filterHasProperty(
    property: string,
    filter: IEntityFilter
): boolean {
    let hasProperty = false

    for (const key of Object.keys(filter)) {
        if (key === 'AND' || key === 'OR') {
            for (const op of filter[key]!) {
                hasProperty = hasProperty || filterHasProperty(property, op)
            }
        } else if (key === property) {
            hasProperty = true
        }
    }

    return hasProperty
}

function logicalOperationFilter(
    filters: IEntityFilter[],
    operator: 'AND' | 'OR',
    columnAliases?: ColumnAliases
) {
    return new Brackets((qb) => {
        if (filters.length > 0) {
            qb.where(getWhereClauseFromFilter(filters[0], columnAliases))
            for (let i = 1; i < filters.length; i++) {
                if (operator === 'AND') {
                    qb.andWhere(
                        getWhereClauseFromFilter(filters[i], columnAliases)
                    )
                } else {
                    qb.orWhere(
                        getWhereClauseFromFilter(filters[i], columnAliases)
                    )
                }
            }
        }
    })
}

// transaltes a given filter operator to the SQL equivalent
function getSQLOperatorFromFilterOperator(op: FilteringOperator) {
    const operators: Record<FilteringOperator, string> = {
        eq: '=',
        neq: '!=',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
        contains: 'LIKE',
        isNull: 'IS NULL',
        in: 'IN',
    }

    return operators[op]
}

// parses the value given for use in SQL
function parseValueForSQLOperator(operator: string, value?: CommonValue) {
    switch (operator) {
        case 'LIKE':
            return `%${value}%`
        default:
            return value
    }
}

// process a composed value to assign the correct property for a given alias
export function processComposedValue(
    composedValue: ComposedValue,
    alias: string
) {
    switch (alias) {
        case 'AgeRange.low_value':
        case 'AgeRange.high_value':
            return composedValue.value
        case 'AgeRange.low_value_unit':
        case 'AgeRange.high_value_unit':
            return composedValue.unit
        default:
            return composedValue
    }
}

// changes the operator when it has not to be the received from filter data
export function setOperatorInComposedValue(
    operator: FilteringOperator,
    alias: string
) {
    switch (alias) {
        case 'AgeRange.low_value_unit':
        case 'AgeRange.high_value_unit':
            return 'eq'
        default:
            return operator
    }
}

// creates case insentive/sensitive condition
function createWhereCondition(
    caseInsensitive: boolean,
    alias: string,
    sqlOperator: string,
    uniqueId: string
) {
    if (sqlOperator === 'IS NULL') {
        return `${alias} ${sqlOperator}`
    }
    if (sqlOperator === 'IN') {
        return `${alias} ${sqlOperator} (:...${uniqueId})`
    }
    if (caseInsensitive) {
        return `lower(${alias}) ${sqlOperator} lower(:${uniqueId})`
    } else {
        return `${alias} ${sqlOperator} :${uniqueId}`
    }
}

// parses the given property name for use in SQL
function parseField(field: string) {
    switch (field) {
        case 'primary': // "primary" is a reserved SQL keyword, so we need to wrap in quotes
            return `"primary"`
        case 'userId':
            return 'user_id'
        case 'schoolId':
            return 'school_id'
        case 'organizationId':
            return 'organization_id'
        case 'givenName':
            return 'given_name'
        case 'familyName':
            return 'family_name'
        case 'roleId':
            return 'role_id'
        default:
            return field
    }
}
