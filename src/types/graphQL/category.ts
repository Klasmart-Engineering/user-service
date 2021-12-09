import { Status } from '../../entities/status'
import { CoreSubjectConnectionNode } from '../../pagination/subjectsConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'

export interface CategoryConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean

    subjectsConnection?: IPaginatedResponse<CoreSubjectConnectionNode>
}

export interface CreateCategoryInput {
    name: string
    organizationId: string
    subcategories?: string[]
}

export interface DeleteCategoryInput {
    id: string
}

export interface UpdateCategoryInput {
    id: string
    name?: string
    subcategories?: string[]
}

export interface AddSubcategoriesToCategoryInput {
    categoryId: string
    subcategoryIds: string[]
}

export interface RemoveSubcategoriesFromCategoryInput {
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
