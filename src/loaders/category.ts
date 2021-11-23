import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'
import { CategoryConnectionNode } from '../types/graphQL/category'
import { Category } from '../entities/category'

export interface ICategoryNodeDataLoader {
    node: Lazy<NodeDataLoader<Category, CategoryConnectionNode>>
}
