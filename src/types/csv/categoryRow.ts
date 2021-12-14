import { EntityRow } from './entityRow'

export interface CategoryRow extends EntityRow {
    category_name: string
    subcategory_name: string
}
