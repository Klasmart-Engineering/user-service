import { EntityRow } from './entityRow'

export interface ClassRow extends EntityRow {
    class_name: string
    class_shortcode?: string
    school_name?: string
    program_name?: string
}
