import { Status } from '../../entities/status'

export interface SubcategorySummaryNode {
    id: string
    name?: string
    status: Status
    system: boolean
}
