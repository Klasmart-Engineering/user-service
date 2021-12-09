import { GraphQLResolveInfo } from 'graphql'
import { SelectQueryBuilder } from 'typeorm'
import { Subject } from '../entities/subject'
import { NodeDataLoader } from '../loaders/genericNode'
import { SubjectConnectionNode } from '../types/graphQL/subject'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { Lazy } from '../utils/lazyLoading'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import {
    IEdge,
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'

export interface ISubjectNodeDataLoaders {
    node: Lazy<NodeDataLoader<Subject, CoreSubjectConnectionNode>>
}

export type CoreSubjectConnectionNode = Pick<
    SubjectConnectionNode,
    'id' | 'name' | 'status' | 'system'
>

export async function subjectsConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Subject>
): Promise<IPaginatedResponse<CoreSubjectConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)
    const newScope = await subjectsConnectionQuery(scope, filter)
    const data = await paginateData<Subject>({
        direction,
        directionArgs,
        scope: newScope,
        sort: {
            ...subjectsConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: data.edges.map(mapSubjectEdgeToSubjectConnectionEdge),
    }
}

function mapSubjectEdgeToSubjectConnectionEdge(
    edge: IEdge<Subject>
): IEdge<SubjectConnectionNode> {
    return {
        node: mapSubjectToSubjectConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export function mapSubjectToSubjectConnectionNode(
    subject: Subject
): SubjectConnectionNode {
    return {
        id: subject.id,
        name: subject.name,
        status: subject.status,
        system: !!subject.system,
    }
}

export const subjectNodeFields = ([
    'id',
    'name',
    'status',
    'system',
] as (keyof Subject)[]).map((field) => `Subject.${field}`)

export async function subjectsConnectionQuery(
    scope: SelectQueryBuilder<Subject>,
    filter?: IEntityFilter
) {
    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.innerJoin('Subject.organization', 'Organization')
        }

        if (filterHasProperty('categoryId', filter)) {
            scope.innerJoin('Subject.categories', 'Category')
        }

        if (filterHasProperty('classId', filter)) {
            scope.innerJoin('Subject.classes', 'Class')
        }

        if (filterHasProperty('programId', filter)) {
            scope.innerJoin('Subject.programs', 'Program')
        }

        scope.andWhere(
            getWhereClauseFromFilter(scope, filter, {
                id: 'Subject.id',
                name: 'Subject.name',
                status: 'Subject.status',
                system: 'Subject.system',
                organizationId: 'Organization.organization_id',
                categoryId: 'Category.id',
                classId: 'Class.class_id',
                programId: 'Program.id',
            })
        )
    }

    scope.select(subjectNodeFields)
    return scope
}

export const subjectsConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'id',
    aliases: {
        id: 'id',
        name: 'name',
        system: 'system',
    },
}
