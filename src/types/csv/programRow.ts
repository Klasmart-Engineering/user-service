import { AgeRangeUnit } from '../../entities/ageRangeUnit'

export interface ProgramRow {
    organization_name: string
    program_name: string
    age_range_high_value: string
    age_range_low_value: string
    age_range_unit: AgeRangeUnit
    grade_name: string
    subject_name: string
}
