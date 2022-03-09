import { createQueryBuilder } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'

// warning: if this query returns a lot of rows it will be very inefficient if used
// in a COUNT(*) FROM ... WHERE IN (<subquery>) clause
// https://calmisland.atlassian.net/wiki/spaces/UserService/pages/2580742303/2022-03-01+How+to+count
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
