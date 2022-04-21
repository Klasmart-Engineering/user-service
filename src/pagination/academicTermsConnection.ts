import { SelectQueryBuilder } from 'typeorm'
import { AcademicTerm } from '../entities/academicTerm'
import { AcademicTermConnectionNode } from '../types/graphQL/academicTerm'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'

export const academicTermNodeFields = ([
    'id',
    'name',
    'start_date',
    'end_date',
    'status',
    'school_id',
] as (keyof AcademicTerm)[]).map((field) => `AcademicTerm.${field}`)

export const academicTermsConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'id',
    aliases: {
        id: 'id',
        name: 'name',
        startDate: 'start_date',
        endDate: 'end_date',
    },
}

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

export async function academicTermsConnectionQuery(
    scope: SelectQueryBuilder<AcademicTerm>,
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
                // Not yet supported, but should be:
                //    startDate: 'AcademicTerm.start_date',
                //    endDate: 'AcademicTerm.end_date',
                schoolId: 'School.school_id',
                classId: 'Class.class_id',
            })
        )
    }
    scope.select(academicTermNodeFields)
    return scope
}
