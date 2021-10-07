import DataLoader from 'dataloader'
import { EntityTarget, getConnection } from 'typeorm'
import { CustomBaseEntity } from '../entities/customBaseEntity'
import { APIError } from '../types/errors/apiError'
import { buildStaticAPIErrorProps } from './generic'

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
        entityClass: EntityTarget<Entity>,
        entityMapper: (entity: Entity) => ReturnEntity,
        selectFields: string[]
    ) {
        super(async function (
            ids: readonly string[]
        ): Promise<(ReturnEntity | APIError)[]> {
            const connection = getConnection()
            const repository = connection.getRepository(entityClass)
            const metadata = connection.getMetadata(entityClass)
            const entityName = metadata.name
            const primaryKeyColumn = metadata.primaryColumns[0]
            const primaryKeyLabel = primaryKeyColumn.propertyName

            const scope = repository
                .createQueryBuilder()
                .select(selectFields)
                .where(`"${entityName}"."${primaryKeyLabel}" IN (:...ids)`, {
                    ids,
                })

            const nodes = new Map<string, ReturnEntity>(
                (await scope.getMany()).map((node) => [
                    primaryKeyColumn.getEntityValue(node),
                    entityMapper(node),
                ])
            )

            const staticErrorProps = buildStaticAPIErrorProps(metadata)

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
