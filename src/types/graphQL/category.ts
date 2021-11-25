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

export interface AddSubcategoriesToCategoryInput {
    categoryId: string
    subcategoryIds: string[]
}

export interface CategoriesMutationResult {
    categories: CategoryConnectionNode[]
}

export interface CategorySubcategory extends CategoryConnectionNode {
    categoryId: string
    subcategoryId: string
}
