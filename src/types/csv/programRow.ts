import { EntityRow } from './entityRow'

export interface ProgramRow extends EntityRow {
    program_name: string
    age_range_high_value: string
    age_range_low_value: string
    age_range_unit: string
    grade_name: string
    subject_name: string
}
