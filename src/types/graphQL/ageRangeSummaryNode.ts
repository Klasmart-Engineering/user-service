import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Status } from '../../entities/status'

export interface AgeRangeSummaryNode {
    id: string
    name?: string
    lowValue: number
    highValue: number
    lowValueUnit: AgeRangeUnit
    highValueUnit: AgeRangeUnit
    status: Status
    system: boolean
}
