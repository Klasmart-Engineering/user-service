import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
} from '../pagination/usersConnection'
import { User } from '../entities/user'
import { APIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { INodeArgs } from '../types/node'

export async function userNodeResolver({
    scope,
    id,
}: INodeArgs<User>): Promise<CoreUserConnectionNode | APIError> {
    scope
        .select(
            ([
                'user_id',
                'given_name',
                'family_name',
                'avatar',
                'status',
                'email',
                'phone',
                'alternate_email',
                'alternate_phone',
                'date_of_birth',
                'gender',
            ] as (keyof User)[]).map((field) => `User.${field}`)
        )
        .andWhere(`${scope.alias}.user_id = :id`, { id })

    const data = await scope.getOne()
    if (!data) {
        return new APIError({
            message: customErrors.nonexistent_entity.message,
            code: customErrors.nonexistent_entity.code,
            variables: ['id'],
            entity: 'User',
        })
    }
    return mapUserToUserConnectionNode(data)
}
