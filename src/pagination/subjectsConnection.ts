import { GraphQLResolveInfo } from 'graphql'
import { Subject } from '../entities/subject'
import { NodeDataLoader } from '../loaders/genericNode'
import {
    SubjectConnectionNode,
    SubjectSummaryNode,
} from '../types/graphQL/subject'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { Lazy } from '../utils/lazyLoading'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
} from '../utils/pagination/filtering'
import {
    IEdge,
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'

export interface ISubjectNodeDataLoaders {
    node: Lazy<NodeDataLoader<Subject, SubjectSummaryNode>>
}

export async function subjectsConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Subject>
): Promise<IPaginatedResponse<SubjectConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.innerJoin('Subject.organization', 'Organization')
        }

        if (filterHasProperty('categoryId', filter)) {
            scope.innerJoin('Subject.categories', 'Category')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Subject.id',
                name: 'Subject.name',
                status: 'Subject.status',
                system: 'Subject.system',
                organizationId: 'Organization.organization_id',
                categoryId: 'Category.id',
            })
        )
    }

    scope.select(subjectNodeFields)

    const data = await paginateData<Subject>({
        direction,
        directionArgs,
        scope,
        sort: {
            primaryKey: 'id',
            aliases: {
                id: 'id',
                name: 'name',
                system: 'system',
            },
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
