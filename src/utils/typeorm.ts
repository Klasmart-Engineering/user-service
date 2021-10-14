import {
    BaseEntity,
    EntityMetadata,
    getConnection,
    SelectQueryBuilder,
} from 'typeorm'
import { RelationIdLoader } from 'typeorm/query-builder/relation-id/RelationIdLoader'
import { RelationCountLoader } from 'typeorm/query-builder/relation-count/RelationCountLoader'
import { RawSqlResultsToEntityTransformer } from 'typeorm/query-builder/transformer/RawSqlResultsToEntityTransformer'

export function scopeHasJoin<E extends BaseEntity>(
    scope: SelectQueryBuilder<E>,
    joinedEntity: EntityMetadata['target']
): boolean {
    return (
        scope.expressionMap.joinAttributes.find(
            (joinAttribute) => joinAttribute.metadata?.target === joinedEntity
        ) !== undefined
    )
}

export async function convertRawToEntities<Entity = unknown>(
    raw: unknown[],
    queryBuilder: SelectQueryBuilder<Entity>
) {
    const connection = getConnection()
    const queryRunner = connection.createQueryRunner()
    const relationIdLoader = new RelationIdLoader(
        connection,
        queryRunner,
        queryBuilder.expressionMap.relationIdAttributes
    )
    const relationCountLoader = new RelationCountLoader(
        connection,
        queryRunner,
        queryBuilder.expressionMap.relationCountAttributes
    )
    const rawRelationIdResults = await relationIdLoader.load(raw)
    const rawRelationCountResults = await relationCountLoader.load(raw)

    const transformer = new RawSqlResultsToEntityTransformer(
        queryBuilder.expressionMap,
        connection.driver,
        rawRelationIdResults,
        rawRelationCountResults,
        queryRunner
    )

    const entities: Entity[] = transformer.transform(
        raw,
        queryBuilder.expressionMap.mainAlias!
    )
    return entities
}
