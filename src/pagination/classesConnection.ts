import { GraphQLResolveInfo } from 'graphql'
import { School } from '../entities/school'
import { Class } from '../entities/class'
import { ClassConnectionNode } from '../types/graphQL/classConnectionNode'
import { findTotalCountInPaginationEndpoints } from '../utils/graphql'
import { getWhereClauseFromFilter } from '../utils/pagination/filtering'
import {
    IEdge,
    IPaginatedResponse,
    IPaginationArgs,
    paginateData,
} from '../utils/pagination/paginate'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'

export const classesConnectionSortingConfig: IConnectionSortingConfig = {
    primaryKey: 'class_id',
    aliases: {
        id: 'class_id',
        name: 'class_name',
        shortCode: 'shortcode',
    },
}

export async function classesConnectionResolver(
    info: GraphQLResolveInfo,
    { direction, directionArgs, scope, filter, sort }: IPaginationArgs<Class>
): Promise<IPaginatedResponse<ClassConnectionNode>> {
    const includeTotalCount = findTotalCountInPaginationEndpoints(info)

    const newScope = await classConnectionQuery({
        direction,
        directionArgs,
        scope,
        filter,
        sort,
    })

    const data = await paginateData<Class>({
        direction,
        directionArgs,
        scope: newScope,
        sort: {
            ...classesConnectionSortingConfig,
            sort,
        },
        includeTotalCount,
    })

    return {
        totalCount: data.totalCount,
        pageInfo: data.pageInfo,
        edges: await Promise.all(
            data.edges.map(mapClassEdgeToClassConnectionEdge)
        ),
    }
}

export async function classConnectionQuery({
    direction = "FORWARD",
    directionArgs = {},
    scope,
    filter,
    sort = undefined,
}: IPaginationArgs<Class>) {
    // Required for building ClassConnectionNode
    scope.innerJoin('Class.schools', 'School')

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                schoolId: 'Class.school',
                classId: 'Class.class_id',
                name: 'class_name', //Why does this not require Class.class_name (Class table)?
                shortCode: 'Class.shortcode',
                status: 'Class.status',
            })
        )
    }

    const selects = ([
        'class_id',
        'class_name',
        'shortcode',
        'status',
    ] as (keyof Class)[]).map((field) => `Class.${field}`)

    selects.push(
        ...(['school_id'] as (keyof School)[]).map(
            (field) => `School.${field}`
        )
    )

    scope.select(selects)

    return scope
}

async function mapClassEdgeToClassConnectionEdge(
    edge: IEdge<Class>
): Promise<IEdge<ClassConnectionNode>> {
    return {
        node: await mapClassToClassConnectionNode(edge.node),
        cursor: edge.cursor,
    }
}

export async function mapClassToClassConnectionNode(
    class: Class
): Promise<ClassConnectionNode> {
    return {
        id: class.class_id,
        name: class.class_name,
        status: class.status,
        shortCode: class.shortcode,
        schools: (await class.organization)?.organization_id || '',
    }
}
