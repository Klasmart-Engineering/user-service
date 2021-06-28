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
    field: string
    order: 'ASC' | 'DESC'
}

export function splitColumns(columns: string) {
    return columns.split(',').map((column) => column.trim())
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
    let primaryColumns

    if (config.sort) {
        primaryColumns =
            config.aliases?.[config.sort.field] || config.sort.field

        const columns = splitColumns(primaryColumns)

        columns.forEach((column) => {
            scope.addOrderBy(`${scope.alias}.${column}`, order, 'NULLS LAST')
        })
    }

    // always sort by the primary key, and always to do it last
    scope.addOrderBy(`${scope.alias}.${config.primaryKey}`, order, 'NULLS LAST')

    return {
        order,
        primaryColumns,
    }
}
