import { GraphQLResolveInfo } from 'graphql'
import { Program } from '../entities/program'
import { ProgramSummaryNode } from '../types/graphQL/program'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import {
    AVOID_NONE_SPECIFIED_BRACKETS,
    filterHasProperty,
    getWhereClauseFromFilter,
} from '../utils/pagination/filtering'
import {
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'

export async function programsConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Program>
): Promise<IPaginatedResponse<ProgramSummaryNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('Program.organization', 'Organization')
        }

        if (filterHasProperty('gradeId', filter)) {
            scope.leftJoinAndSelect('Program.grades', 'Grade')
        }

        if (
            filterHasProperty('ageRangeFrom', filter) ||
            filterHasProperty('ageRangeTo', filter)
        ) {
            scope
                .leftJoinAndSelect('Program.age_ranges', 'AgeRange')
                .where(AVOID_NONE_SPECIFIED_BRACKETS)
        }

        if (filterHasProperty('subjectId', filter)) {
            scope.leftJoinAndSelect('Program.subjects', 'Subject')
        }

        if (filterHasProperty('schoolId', filter)) {
            scope.leftJoinAndSelect('Program.schools', 'School')
        }

        if (filterHasProperty('classId', filter)) {
            scope.leftJoin('Program.classes', 'Class')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Program.id',
                name: 'Program.name',
                system: 'Program.system',
                status: 'Program.status',
                organizationId: 'Organization.organization_id',
                gradeId: 'Grade.id',
                ageRangeFrom: {
                    operator: 'AND',
                    aliases: ['AgeRange.low_value', 'AgeRange.low_value_unit'],
                },
                ageRangeTo: {
                    operator: 'AND',
                    aliases: [
                        'AgeRange.high_value',
                        'AgeRange.high_value_unit',
                    ],
                },
                subjectId: 'Subject.id',
                schoolId: 'School.school_id',
                classId: 'Class.class_id',
            })
        )
    }

    scope.select(programSummaryNodeFields)

    const data = await paginateData<Program>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'id',
            aliases: {
                id: 'id',
                name: 'name',
            },
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map((edge) => {
            return {
                node: mapProgramToProgramConnectionNode(edge.node),
                cursor: edge.cursor,
            }
        }),
    }
}

export function mapProgramToProgramConnectionNode(
    program: Program
): ProgramSummaryNode {
    return {
        id: program.id,
        name: program.name,
        status: program.status,
        system: program.system,
        // other properties have dedicated resolvers that use Dataloader
    }
}

export const programSummaryNodeFields = ([
    'id',
    'name',
    'status',
    'system',
] as (keyof Program)[]).map((field) => `Program.${field}`)
