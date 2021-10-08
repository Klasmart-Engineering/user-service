import DataLoader from 'dataloader'
import {
    BaseEntity,
    EntityMetadata,
    EntityTarget,
    getConnection,
} from 'typeorm'
import { APIError, IAPIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'

export function buildStaticAPIErrorProps(
    metadata: EntityMetadata
): Pick<IAPIError, 'code' | 'message' | 'entity' | 'variables'> {
    return {
        message: customErrors.nonexistent_entity.message,
        code: customErrors.nonexistent_entity.code,
        variables: metadata.primaryColumns.map((c) => c.propertyName),
        entity: metadata.name,
    }
}

/**
 * Generic DataLoader for any Entity with a UUID primary key
 *
 *  Returns the Entity for an existent key, ERR_NONEXISTENT_ENTITY APIError for any nonexistent key
 */
export class UUIDDataLoader<Entity extends BaseEntity> extends DataLoader<
    string,
    Entity | APIError
> {
    constructor(entityClass: EntityTarget<Entity>) {
        super(async function (
            ids: readonly string[]
        ): Promise<(Entity | APIError)[]> {
            const connection = getConnection()
            const repository = connection.getRepository(entityClass)
            const metadata = connection.getMetadata(entityClass)
            const primaryKeyColumn = metadata.primaryColumns[0]

            const map = new Map<string, Entity>(
                (await repository.findByIds(ids as string[])).map((entity) => [
                    primaryKeyColumn.getEntityValue(entity),
                    entity,
                ])
            )

            const staticErrorProps = buildStaticAPIErrorProps(metadata)

            return ids.map(
                (id) =>
                    map.get(id) ??
                    new APIError({
                        ...staticErrorProps,
                        entityName: id,
                    })
            )
        })
    }
}
