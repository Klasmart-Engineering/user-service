import { Status } from '../../entities/status'

export interface CategoryConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
}

export interface CreateCategoryInput {
    name: string
    organizationId: string
    subcategories?: string[]
}

export interface CategoriesMutationResult {
    categories: CategoryConnectionNode[]
}
