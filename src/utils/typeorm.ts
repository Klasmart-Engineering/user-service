import { BaseEntity, EntityMetadata, SelectQueryBuilder } from 'typeorm'

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
