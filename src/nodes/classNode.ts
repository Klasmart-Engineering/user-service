import { Class } from '../entities/class'
import { ClassConnectionNode } from '../types/graphQL/classConnectionNode'

/**
 * Core fields on `ClassConnectionNode` not populated by a DataLoader
 */
export type CoreClassConnectionNode = Pick<
    ClassConnectionNode,
    'id' | 'name' | 'status' | 'shortCode'
>

export const CLASS_NODE_COLUMNS = [
    'Class.class_id',
    'Class.class_name',
    'Class.status',
    'Class.shortcode',
]

export function mapClassToClassNode(class_: Class): CoreClassConnectionNode {
    return {
        id: class_.class_id,
        name: class_.class_name,
        status: class_.status,
        shortCode: class_.shortcode,
    }
}
