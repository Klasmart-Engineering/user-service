import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'
import { CategorySummaryNode } from '../types/graphQL/category'
import { Category } from '../entities/category'

export interface ICategoryNodeDataLoader {
    node: Lazy<NodeDataLoader<Category, CategorySummaryNode>>
}
