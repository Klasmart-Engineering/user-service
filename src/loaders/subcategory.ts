import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'
import { SubcategoryConnectionNode } from '../types/graphQL/subcategory'
import { Subcategory } from '../entities/subcategory'

export interface ISubcategoryNodeDataLoader {
    node: Lazy<NodeDataLoader<Subcategory, SubcategoryConnectionNode>>
}
