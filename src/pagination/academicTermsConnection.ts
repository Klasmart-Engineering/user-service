import { AcademicTerm } from '../entities/academicTerm'
import { AcademicTermConnectionNode } from '../types/graphQL/academicTerm'

export function mapATtoATConnectionNode(
    academicTerm: AcademicTerm
): AcademicTermConnectionNode {
    return {
        id: academicTerm.id,
        name: academicTerm.name,
        startDate: academicTerm.start_date,
        endDate: academicTerm.end_date,
        status: academicTerm.status,
        schoolId: academicTerm.school_id,
    }
}
