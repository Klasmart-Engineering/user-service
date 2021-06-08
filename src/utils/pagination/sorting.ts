import { SelectQueryBuilder } from 'typeorm'

export interface ISortingConfig {
    defaultField: string
    primaryField?: ISortField
    aliases?: {
        [field: string]: {
            select: string
            type?: 'string' | 'date'
        }
    }
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

    let primaryColumn = ''
    let defaultColumn = ''

    if (config.primaryField) {
        const columnName =
            config.aliases?.[config.primaryField.field].select ||
            config.primaryField.field

        scope.addOrderBy(columnName, order, 'NULLS LAST')
        primaryColumn = columnName
        if (config.aliases?.[config.primaryField.field].type === 'date') {
            // TODO explanation for this....
            primaryColumn = `date_trunc('second', ${columnName})`
        }
        scope.addSelect(`${columnName} as "${scope.alias}_pagination_cursor"`)
    }
    defaultColumn = config.defaultField
    scope.addOrderBy(
        `${scope.alias}.${config.defaultField}`,
        order,
        'NULLS LAST'
    )

    return {
        order,
        primaryColumn,
        defaultColumn,
    }
}
