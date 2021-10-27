import { Status } from '../../entities/status'

export interface SubcategoryConnectionNode {
    id: string
    name: string
    status: Status
    system: boolean
}
