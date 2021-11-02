import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRange'
import { AgeRange } from '../entities/ageRange'

export interface IAgeRangeNodeDataLoader {
    node: Lazy<NodeDataLoader<AgeRange, AgeRangeConnectionNode>>
}
