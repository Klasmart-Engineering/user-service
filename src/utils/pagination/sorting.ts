import { SelectQueryBuilder } from 'typeorm'

export interface ISortingConfig {
    defaultField: string
    primaryField?: ISortField
    aliases?: Record<string, string>
}

export interface ISortField {
    field: string
    order: 'ASC' | 'DESC'
}

export function addOrderByClause(
    scope: SelectQueryBuilder<unknown>,
    config: ISortingConfig,
    direction: string
) {
    let order = config.primaryField?.order || 'ASC'
    if (direction === 'BACKWARD') {
        // swap the order
        if (order === 'ASC') {
            order = 'DESC'
        } else {
            order = 'ASC'
        }
    }

    let computedCursorColumn = config.defaultField

    if (config.primaryField) {
        const columnName =
            config.aliases?.[config.primaryField.field] ||
            config.primaryField.field

        scope.addOrderBy(columnName, order, 'NULLS LAST')
        computedCursorColumn = `${columnName} || ${config.defaultField}`
    }
    scope.addOrderBy(config.defaultField, order, 'NULLS LAST')

    scope.addSelect(
        `${computedCursorColumn} as "${scope.alias}_pagination_cursor"`
    )

    return {
        order,
        computedCursorColumn,
    }
}
