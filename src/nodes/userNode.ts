import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
    selectUserFields,
} from '../pagination/usersConnection'
import { User } from '../entities/user'
import { APIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { INodeArgs } from '../types/node'

export async function userNodeResolver({
    scope,
    id,
}: INodeArgs<User>): Promise<CoreUserConnectionNode | APIError> {
    const data = await selectUserFields(scope)
        .andWhere(`${scope.alias}.user_id = :id`, { id })
        .getOne()
    if (!data) {
        return new APIError({
            message: customErrors.nonexistent_entity.message,
            code: customErrors.nonexistent_entity.code,
            variables: ['id'],
            entity: 'UserConnectionNode',
            entityName: id,
        })
    }
    return mapUserToUserConnectionNode(data)
}
