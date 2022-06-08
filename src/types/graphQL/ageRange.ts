import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Status } from '../../entities/status'

export interface AgeRangeConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    lowValue: number
    highValue: number
    lowValueUnit: AgeRangeUnit
    highValueUnit: AgeRangeUnit
}

export interface CreateAgeRangeInput {
    name: string
    lowValue: number
    highValue: number
    lowValueUnit: AgeRangeUnit
    highValueUnit: AgeRangeUnit
    organizationId: string
}

export interface DeleteAgeRangeInput {
    id: string
}

export interface UpdateAgeRangeInput {
    id: string
    name?: string
    lowValue?: number
    highValue?: number
    lowValueUnit?: AgeRangeUnit
    highValueUnit?: AgeRangeUnit
}

export interface AgeRangesMutationResult {
    ageRanges: AgeRangeConnectionNode[]
}
