import { EntityRow } from './entityRow'

export interface GradeRow extends EntityRow {
    grade_name: string
    progress_from_grade_name: string
    progress_to_grade_name: string
}
