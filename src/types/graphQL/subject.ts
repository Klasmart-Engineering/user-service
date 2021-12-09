import { Status } from '../../entities/status'
import { CategoryConnectionNode } from './category'

export interface SubjectConnectionNode {
    id: string
    name?: string
    status: Status
    system: boolean
    categories?: CategoryConnectionNode[]
}
