import { Status } from '../../entities/status'

export interface ProgramSummaryNode {
    id: string
    name?: string
    status: Status
    system: boolean
}
