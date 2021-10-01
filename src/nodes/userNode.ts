import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
} from '../pagination/usersConnection'
import { User } from '../entities/user'
import { BaseEntity, SelectQueryBuilder } from 'typeorm'

export interface INodeArgs<Entity extends BaseEntity> {
    scope: SelectQueryBuilder<Entity>
    id: string
}

export async function userNodeResolver({
    scope,
    id,
}: INodeArgs<User>): Promise<CoreUserConnectionNode> {
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
        .where(`${scope.alias}.user_id = :id`, { id })

    const data = await scope.getOneOrFail()
    return mapUserToUserConnectionNode(data)
}
