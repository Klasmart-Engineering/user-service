import { Status } from '../../entities/status'

export interface AcademicTermConnectionNode {
    id: string
    name: string
    startDate: Date
    endDate: Date
    status: Status
    // not exposed in graphql schema
    // but used by child resolver for fetching
    // school
    schoolId: string
}

export interface CreateAcademicTermInput {
    schoolId: string
    name: string
    startDate: Date
    endDate: Date
}

export interface DeleteAcademicTermInput {
    id: string
}

export interface AcademicTermsMutationResult {
    academicTerms: AcademicTermConnectionNode[]
}
