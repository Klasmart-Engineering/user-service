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
    value: string | number | boolean
    caseInsensitive?: boolean
}

// generates a WHERE clause for a given query filter
export function getWhereClauseFromFilter(
    filter: IEntityFilter,
    columnsAliases?: any
): Brackets {
    return new Brackets((qb) => {
        for (const key of Object.keys(filter)) {
            if (key === 'OR' || key === 'AND') {
                // process these recursively afterwards
                continue
            }
            const data = filter[key] as IFilter

            if (data.operator === 'contains' && data.value === '') {
                continue
            }

            const field =
                columnsAliases && columnsAliases[key]
                    ? columnsAliases[key]
                    : parseField(key)
            const sqlOperator = getSQLOperatorFromFilterOperator(data.operator)
            const value = parseValueForSQLOperator(sqlOperator, data.value)

            // parameter keys must be unique when using typeorm querybuilder
            const uniqueId = uuid_v4()

            if (data.caseInsensitive) {
                qb.andWhere(
                    `lower(${field}) ${sqlOperator} lower(:${uniqueId})`,
                    { [uniqueId]: value }
                )
            } else {
                qb.andWhere(`${field} ${sqlOperator} :${uniqueId}`, {
                    [uniqueId]: value,
                })
            }
        }

        if (filter.OR) {
            qb.andWhere(logicalOperationFilter(filter.OR, 'OR', columnsAliases))
        }
        if (filter.AND) {
            qb.andWhere(
                logicalOperationFilter(filter.AND, 'AND', columnsAliases)
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
    columnsAliases?: any
) {
    return new Brackets((qb) => {
        if (filters.length > 0) {
            qb.where(getWhereClauseFromFilter(filters[0], columnsAliases))
            for (let i = 1; i < filters.length; i++) {
                if (operator === 'AND') {
                    qb.andWhere(
                        getWhereClauseFromFilter(filters[i], columnsAliases)
                    )
                } else {
                    qb.orWhere(
                        getWhereClauseFromFilter(filters[i], columnsAliases)
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
