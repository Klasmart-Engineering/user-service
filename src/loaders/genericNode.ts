import DataLoader from 'dataloader'
import { EntityTarget, getConnection, SelectQueryBuilder } from 'typeorm'
import { CustomBaseEntity } from '../entities/customBaseEntity'
import { APIError, IAPIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'

function buildStaticAPIErrorProps(
    nodeType: string
): Pick<IAPIError, 'code' | 'message' | 'entity' | 'variables'> {
    return {
        message: customErrors.nonexistent_entity.message,
        code: customErrors.nonexistent_entity.code,
        variables: ['id'],
        entity: nodeType,
    }
}

interface Node {
    id: string
}

/**
 * Generic NodeDataLoader for any Entity with a UUID primary key
 *
 *  Returns the Mapped Entity for an existent key, ERR_NONEXISTENT_ENTITY APIError for any nonexistent key
 */
export class NodeDataLoader<
    Entity extends CustomBaseEntity,
    ReturnEntity extends Node
> extends DataLoader<string, ReturnEntity | APIError> {
    constructor(
        scope: SelectQueryBuilder<Entity>,
        entityClass: EntityTarget<Entity>,
        nodeType: string,
        entityMapper: (entity: Entity) => ReturnEntity,
        selectFields: string[]
    ) {
        super(async function (
            ids: readonly string[]
        ): Promise<(ReturnEntity | APIError)[]> {
            const connection = getConnection()
            const metadata = connection.getMetadata(entityClass)
            const primaryKeyColumn = metadata.primaryColumns[0]
            const primaryKeyLabel = primaryKeyColumn.propertyName

            scope
                .select(selectFields)
                .andWhere(
                    `"${scope.alias}"."${primaryKeyLabel}" IN (:...ids)`,
                    {
                        ids,
                    }
                )

            const nodes = new Map<string, ReturnEntity>(
                (await scope.getMany()).map((node) => [
                    primaryKeyColumn.getEntityValue(node),
                    entityMapper(node),
                ])
            )

            const staticErrorProps = buildStaticAPIErrorProps(nodeType)

            return ids.map(
                (id) =>
                    nodes.get(id) ??
                    new APIError({
                        ...staticErrorProps,
                        entityName: id,
                    })
            )
        })
    }
}
