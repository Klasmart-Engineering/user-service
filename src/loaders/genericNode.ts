import DataLoader from 'dataloader'
import { SelectQueryBuilder } from 'typeorm'
import { CustomBaseEntity } from '../entities/customBaseEntity'
import { APIError, IAPIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'

export function buildStaticAPIErrorProps(
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
> extends DataLoader<
    { id: string; scope: SelectQueryBuilder<Entity> },
    ReturnEntity | APIError
> {
    constructor(
        entityClass: (new () => Entity) & typeof CustomBaseEntity,
        nodeType: string,
        entityMapper: (entity: Entity) => ReturnEntity,
        selectFields: string[]
    ) {
        super(async function (
            keys: readonly { id: string; scope: SelectQueryBuilder<Entity> }[]
        ): Promise<(ReturnEntity | APIError)[]> {
            const repository = entityClass.getRepository()
            const metadata = repository.metadata
            const primaryKeyColumn = metadata.primaryColumns[0]
            const primaryKeyLabel = primaryKeyColumn.propertyName
            const ids = []
            const scope = keys[0].scope
            for (const key of keys) {
                ids.push(key.id)
            }
            scope
                .select(selectFields)
                .andWhere(
                    `"${scope.alias}"."${primaryKeyLabel}" IN (:...dataloaderNodeIds)`,
                    {
                        dataloaderNodeIds: ids, // use a specific parameter name to avoid conflicting with others
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
