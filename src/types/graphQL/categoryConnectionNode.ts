import { Status } from '../../entities/status'
import { ProgramSummaryNode } from './programSummaryNode'
import { SubcategorySummaryNode } from './subcategorySummaryNode'
import { SubjectSummaryNode } from './subjectSummaryNode'

export interface CategoryConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    subcategories?: SubcategorySummaryNode[]
    subjects?: SubjectSummaryNode[]
    programs?: ProgramSummaryNode[]
}
