import { Status } from '../../entities/status'

export interface SubcategoryConnectionNode {
    id: string
    name: string
    status: Status
    system: boolean
}

export interface DeleteSubcategoryInput {
    id: string
}

export interface SubcategoriesMutationResult {
    subcategories: SubcategoryConnectionNode[]
}

export interface UpdateSubcategoryInput {
    id: string
    name?: string
}
