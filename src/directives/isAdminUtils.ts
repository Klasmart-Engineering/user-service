import { createQueryBuilder, SelectQueryBuilder } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'
import { User } from '../entities/user'

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

// possible todo: we could dataload this
// although it would have 2 side effects:
// increasing the size of :...user_ids which is bad for query performance
// and requring application post-processing of the results to discern which loads failed
// Alternative: we could fail all loads if any user is out of scope
// which would allow us to get the post processing check as numberOfUsersFound !== users.length
export async function isAdminUserScopeWrapper(
    scope: SelectQueryBuilder<User>,
    field: Promise<User[]> | undefined
) {
    const users = await field
    if (users === undefined || users.length === 0) {
        return users
    }
    // possible todo: optimzize this for big user_ids length
    // https://stackoverflow.com/a/24647700
    // INNER JOIN (
    //     VALUES (1), (2), (3), (4), (5)
    //   ) vals(v)
    //   ON (somevalue = v);
    // open questions:
    // * how to do this with typeORM
    // * confirm this changes our query plans
    // * also compare to IN(VALUES (1), ....)

    const numberOfUsersFound = await scope
        .andWhere('"User".user_id IN (:...user_ids)', {
            user_ids: users.map((s) => s.user_id),
        })
        .getCount()

    if (numberOfUsersFound !== users.length) {
        return undefined
    }
    return users
}
