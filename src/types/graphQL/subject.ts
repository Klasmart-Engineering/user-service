import { Status } from '../../entities/status'
import { CategoryConnectionNode } from './category'

export interface SubjectConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    categories?: CategoryConnectionNode[]
}

export interface CreateSubjectInput {
    name: string
    organizationId: string
    categoryIds?: string[]
}

export interface UpdateSubjectInput {
    id: string
    name?: string
    categoryIds?: string[]
}

export interface SubjectsMutationOutput {
    subjects: SubjectConnectionNode[]
}
