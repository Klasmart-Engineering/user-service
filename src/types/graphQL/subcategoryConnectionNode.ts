import { Status } from '../../entities/status'
import { CategorySummaryNode } from './categorySummaryNode'
import { ProgramSummaryNode } from './programSummaryNode'
import { SubjectSummaryNode } from './subjectSummaryNode'

export interface SubcategoryConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    categories?: CategorySummaryNode[]
    subjects?: SubjectSummaryNode[]
    programs?: ProgramSummaryNode[]
}
