import { Brackets } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'

export interface IEntityFilter {
    [key: string]: IFilter | IEntityFilter[] | undefined

    OR?: IEntityFilter[]
    AND?: IEntityFilter[]
}

type FilteringOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains'

interface IFilter {
    operator: FilteringOperator
    value: string | number | boolean | Record<string, string | number | boolean>
    caseInsensitive?: boolean
}

type ColumnAliases = Record<string, string[]> // use empty to ignore

const FILTER_VALUE_MAX_LENGTH = 250

// these aliases won't be used to filter if neq operator is applied
const AVOID_NOT_EQUAL_OPERATOR_ALIASES = [
    'AgeRange.low_value_unit',
    'AgeRange.high_value_unit',
]

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
            if (columnAliases?.[key]) {
                if (columnAliases?.[key].length === 0) {
                    qb.andWhere('true')
                    continue // avoid returning empty brackets
                }
                aliases = columnAliases?.[key]
            }

            for (const alias of aliases) {
                let currentValue = data.value
                let currentOperator = data.operator

                // a value of type object is considered as a compound value
                if (typeof currentValue === 'object') {
                    // in a neq opeartion is necessary check if is correct to check the current alias
                    if (
                        currentOperator === 'neq' &&
                        AVOID_NOT_EQUAL_OPERATOR_ALIASES.includes(alias)
                    ) {
                        continue
                    }

                    // resetting value and operator to work properly with the given compound value
                    currentValue = processComposedValue(currentValue, alias)
                    currentOperator = setOperatorInComposedValue(
                        currentOperator,
                        alias
                    )
                }

                const sqlOperator = getSQLOperatorFromFilterOperator(
                    currentOperator
                )

                const value = parseValueForSQLOperator(
                    sqlOperator,
                    currentValue
                )

                // parameter keys must be unique when using typeorm querybuilder
                const uniqueId = uuid_v4()

                if (data.caseInsensitive) {
                    qb.andWhere(
                        `lower(${alias}) ${sqlOperator} lower(:${uniqueId})`,
                        { [uniqueId]: value }
                    )
                } else {
                    qb.andWhere(`${alias} ${sqlOperator} :${uniqueId}`, {
                        [uniqueId]: value,
                    })
                }
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
    }

    return operators[op]
}

// parses the value given for use in SQL
function parseValueForSQLOperator(operator: string, value: unknown) {
    switch (operator) {
        case 'LIKE':
            return `%${value}%`
        default:
            return value
    }
}

// process a composed value to assign the correct property for a given alias
export function processComposedValue(
    composedValue: Record<string, string | number | boolean>,
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
