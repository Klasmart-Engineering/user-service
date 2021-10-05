import DataLoader from 'dataloader'
import { User } from '../entities/user'
import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
} from '../pagination/usersConnection'
import { APIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'

export interface IUserNodesLoaders {
    userNode: DataLoader<string, CoreUserConnectionNode | APIError>
}

export async function userNodesByIds(
    userIds: readonly string[]
): Promise<(CoreUserConnectionNode | Error)[]> {
    const userNodes = new Map(
        (await User.findByIds(userIds as string[])).map((user) => [
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
