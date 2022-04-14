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

export type CoreAcademicTermConnectionNode = Pick<
    AcademicTermConnectionNode,
    'id' | 'name' | 'status' | 'startDate' | 'endDate'
>

export async function programsConnectionQuery(
    scope: SelectQueryBuilder<Program>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('schoolId', filter)) {
            scope.leftJoinAndSelect('AcademicTerm.school', 'School')
        }

        if (filterHasProperty('classId', filter)) {
            scope.leftJoin('AcademicTerm.classes', 'Class')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'AcademicTerm.id',
                name: 'AcademicTerm.name',
                status: 'AcademicTerm.status',
                schoolId: 'School.school_id',
                classId: 'Class.class_id',
            })
        )
    }

    scope.select(academicTermSummaryNodeFields)
    return scope
}

export const academicTermSummaryNodeFields = ([
    'id',
    'name',
    'status',
    'startDate',
    'endDate',
] as (keyof AcademicTerm)[]).map((field) => `AcademicTerm.${field}`)
