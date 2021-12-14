import { EntityRow } from './entityRow'

export interface AgeRangeRow extends EntityRow {
    age_range_high_value: string
    age_range_low_value: string
    age_range_unit: string
}
