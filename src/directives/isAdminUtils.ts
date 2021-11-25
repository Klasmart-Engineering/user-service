import { createQueryBuilder } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'

export function distinctMembers(
    membershipTable: string,
    idColumn: string,
    ids: string[]
) {
    if (ids.length > 0) {
        const uniqueId = uuid_v4()
        return createQueryBuilder()
            .select('membership_table.userUserId', 'user_id')
            .from(membershipTable, 'membership_table')
            .andWhere(`membership_table.${idColumn} IN (:...${uniqueId})`, {
                [uniqueId]: ids,
            })
    } else {
        return undefined
    }
}
