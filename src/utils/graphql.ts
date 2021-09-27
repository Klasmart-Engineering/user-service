import { GraphQLResolveInfo } from 'graphql'

export function findTotalCountInPaginationEndpoints(info: GraphQLResolveInfo) {
    const fieldNodes = info.fieldNodes
    return !!fieldNodes.find((fn) =>
        fn.selectionSet?.selections.find(
            (s) => s.kind === 'Field' && s.name.value === 'totalCount'
        )
    )
}
