import { EntityTarget, getConnection } from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'
import { CustomBaseEntity } from '../entities/customBaseEntity'

export const getPrimaryKeyColumn = (
    entityClass: EntityTarget<CustomBaseEntity>
): ColumnMetadata => {
    const connection = getConnection()
    const metadata = connection.getMetadata(entityClass)
    return metadata.primaryColumns[0]
}
