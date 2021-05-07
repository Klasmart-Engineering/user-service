import { User } from "./entities/user";
import { IEntityFilter, getWhereClauseFromFilter } from "./utils/pagination/filtering";

export const orgsForUsers = async(keys: readonly string[], filter?: IEntityFilter) => {
    const scope = await User.createQueryBuilder('user')
        .leftJoinAndSelect('user.memberships', 'memberships')
        .leftJoinAndSelect('memberships.organization', 'organization')
        .leftJoinAndSelect('memberships.roles', 'roles')
        .where("user.user_id IN (:...ids)", {ids: keys})

    if (filter) {
        scope.andWhere(getWhereClauseFromFilter(filter, {
            organizationId: "memberships.organization_id",
        }))
    }

    const users = await scope.getMany();
    return users.map((user) => user.memberships);
};

export const schoolsForUsers = async(keys: readonly string[], filter?: IEntityFilter) => {
    const scope = await User.createQueryBuilder('user')
        .leftJoinAndSelect('user.school_memberships', 'memberships')
        .leftJoinAndSelect('memberships.school', 'school')
        .leftJoinAndSelect('memberships.roles', 'roles')
        .leftJoinAndSelect('school.organization', 'organization')
        .where("user.user_id IN (:...ids)", {ids: keys})

    if (filter) {
        scope.andWhere(getWhereClauseFromFilter(filter, {
            organizationId: "organization.organization_id",
        }))
    }

    const users = await scope.getMany();

    // satisfy dataloader constraint
    const result  = []
    for (const key of keys) {
        const user = users.find(u => u.user_id === key);
        if (user) {
            result.push((user.school_memberships))
        } else {
            result.push([]);
        }
    }

    return result;
};

