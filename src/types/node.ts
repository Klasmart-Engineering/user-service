import { BaseEntity, SelectQueryBuilder } from 'typeorm'

export interface INodeArgs<Entity extends BaseEntity> {
    scope: SelectQueryBuilder<Entity>
    id: string
}
