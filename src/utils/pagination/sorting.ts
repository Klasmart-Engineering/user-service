import { SelectQueryBuilder } from 'typeorm'
import { Direction } from './paginate'

export interface IConnectionSortingConfig {
    // primary key to sort on by default
    // e.g. user_id for User table
    primaryKey: string

    // mapping of fields from GraphQL schema to columns for the SQL query
    aliases?: Record<string, string>
}

export interface ISortingConfig extends IConnectionSortingConfig {
    // optional field to sort on
    sort?: ISortField
}

export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
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
    let order = config.sort?.order || SortOrder.ASC
    let primaryKeyOrder = SortOrder.ASC

    if (direction === 'BACKWARD') {
        primaryKeyOrder = SortOrder.DESC

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

            /*
            a primaryColumn from a joined entity is written as <table>.<column>,
            if this one comes from a joined entity we have to use it without join scope.alias
            */
            const column = isJoinedColumn(primaryColumn)
                ? primaryColumn
                : `${scope.alias}.${primaryColumn}`

            primaryColumns.push(primaryColumn)
            scope.addOrderBy(column, order, 'NULLS LAST')
        })
    }

    if (!primaryColumns.includes(config.primaryKey)) {
        // sort by the primary in ASC order key lastly, if this is not in the primaryColumns
        scope.addOrderBy(
            `${scope.alias}.${config.primaryKey}`,
            primaryKeyOrder,
            'NULLS LAST'
        )
    }

    return {
        order,
        primaryColumns,
        primaryKeyOrder,
    }
}

export function isJoinedColumn(primaryColumn: string) {
    return primaryColumn.split('.').length === 2
}
