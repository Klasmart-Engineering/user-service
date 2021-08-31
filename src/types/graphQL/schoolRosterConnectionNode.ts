import { Status } from '../../entities/status'
// import { RoleSummaryNode } from "./roleSummaryNode";

export interface SchoolRosterConnectionNode {
    id: string
    givenName: string
    familyName: string
    email: string
    phone: string
    status: Status
    role: string
    // role?: RoleSummaryNode
}
