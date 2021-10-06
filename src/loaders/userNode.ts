import DataLoader from 'dataloader'
import { User } from '../entities/user'
import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
    selectUserFields,
} from '../pagination/usersConnection'
import { APIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'

export interface IUserNodesLoaders {
    userNode: DataLoader<string, CoreUserConnectionNode | APIError>
}

export async function userNodesByIds(
    userIds: readonly string[]
): Promise<(CoreUserConnectionNode | APIError)[]> {
    const scope = User.createQueryBuilder()
        .select(selectUserFields())
        .where('user_id IN (:...ids)', { ids: userIds })
    const userNodes = new Map(
        (await scope.getMany()).map((user) => [
            user.user_id,
            mapUserToUserConnectionNode(user),
        ])
    )

    return userIds.map(
        (id) =>
            userNodes.get(id) ??
            new APIError({
                message: customErrors.nonexistent_entity.message,
                code: customErrors.nonexistent_entity.code,
                variables: ['id'],
                entity: 'UserConnectionNode',
                entityName: id,
            })
    )
}
