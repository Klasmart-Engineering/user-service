import { EntityRow } from './entityRow'

export interface SchoolRow extends EntityRow {
    school_name: string
    school_shortcode: string
    program_name: string
}
