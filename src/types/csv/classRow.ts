import { AgeRangeUnit } from '../../entities/ageRangeUnit'

export interface ClassRow {
    organization_name: string
    class_name: string
    class_shortcode?: string
    school_name?: string
    program_name?: string
    grade_name?: string
    subject_name?: string
    age_range_low_value?: string
    age_range_high_value?: string
    age_range_unit?: AgeRangeUnit
    academic_period?: string
}
