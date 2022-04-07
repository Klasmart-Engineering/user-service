import { Status } from '../../entities/status'

export interface AcademicTermConnectionNode {
    id: string
    name: string
    startDate: Date
    endDate: Date
    status: Status
}

export interface CreateAcademicTermInput {
    schoolId: string
    name: string
    startDate: Date
    endDate: Date
}

export interface AcademicTermsMutationResult {
    academicTerms: AcademicTermConnectionNode[]
}
