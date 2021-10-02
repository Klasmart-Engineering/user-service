import { Class } from '../entities/class'
import { APIError } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'
import { ClassConnectionNode } from '../types/graphQL/classConnectionNode'
import { INodeArgs } from '../types/node'

export async function classNodeResolver({ scope, id }: INodeArgs<Class>) {
    // Select only the ClassConnectionNode fields
    scope
        .select([
            'Class.class_id',
            'Class.class_name',
            'Class.status',
            'Class.shortcode',
        ])
        .andWhere('Class.class_id = :id', { id })

    try {
        const data = await scope.getOneOrFail()
        const newNode: Partial<ClassConnectionNode> = {
            id: data.class_id,
            name: data.class_name,
            status: data.status,
            shortCode: data.shortcode,
            // other properties have dedicated resolvers that use Dataloader
        }

        return newNode
    } catch (error) {
        throw new APIError({
            message: customErrors.nonexistent_entity.message,
            code: customErrors.nonexistent_entity.code,
            variables: ['class_id'],
            entity: 'Class',
            entityName: id,
        })
    }
}
