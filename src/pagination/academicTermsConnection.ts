import { AcademicTerm } from '../entities/academicTerm'
import { AcademicTermConnectionNode } from '../types/graphQL/academicTerm'

export async function mapATtoATConnectionNode(
    academicTerm: AcademicTerm
): Promise<AcademicTermConnectionNode> {
    return {
        id: academicTerm.id,
        name: academicTerm.name,
        startDate: academicTerm.start_date,
        endDate: academicTerm.end_date,
        status: academicTerm.status,
    }
}
