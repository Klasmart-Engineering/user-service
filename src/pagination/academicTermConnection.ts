import { AcademicTerm } from '../entities/academicTerm'
import { AcademicTermConnectionNode } from '../types/graphQL/academicTerm'

export function mapAcademicTermToAcademicTermNode(
    academicTerm: AcademicTerm
): AcademicTermConnectionNode {
    return {
        id: academicTerm.id,
        name: academicTerm.name,
        startDate: academicTerm.start_date,
        endDate: academicTerm.end_date,
        status: academicTerm.status,
    }
}
