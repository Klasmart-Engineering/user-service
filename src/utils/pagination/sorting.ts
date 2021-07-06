import { SelectQueryBuilder } from 'typeorm'
import { Direction } from './paginate'

export interface ISortingConfig {
    // primary key to sort on by default
    // e.g. user_id for User table
    primaryKey: string

    // optional field to sort on
    sort?: ISortField

    // mapping of fields from GraphQL schema to columns for the SQL query
    aliases?: Record<string, string>
}

// TS interface for the sort input in the GraphQL request
// e.g. UserSortInput for usersConnection
export interface ISortField {
    field: string | string[]
    order: 'ASC' | 'DESC'
}

export function addOrderByClause(
    scope: SelectQueryBuilder<unknown>,
    direction: Direction,
    config: ISortingConfig
) {
    // reverse order if pagination backwards
    let order = config.sort?.order || 'ASC'
    if (direction === 'BACKWARD') {
        if (order === 'ASC') {
            order = 'DESC'
        } else {
            order = 'ASC'
        }
    }

    // aliases column to sort by first
    const primaryColumns: string[] = []

    if (config.sort) {
        let fields = config.sort.field

        if (typeof fields === 'string') {
            fields = [fields]
        }

        fields.forEach((field) => {
            const primaryColumn = config.aliases?.[field] || field
            primaryColumns.push(primaryColumn)
            scope.addOrderBy(
                `${scope.alias}.${primaryColumn}`,
                order,
                'NULLS LAST'
            )
        })
    }

    // always sort by the primary key, and always to do it last
    scope.addOrderBy(`${scope.alias}.${config.primaryKey}`, order, 'NULLS LAST')

    return {
        order,
        primaryColumns,
    }
}
