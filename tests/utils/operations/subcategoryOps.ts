import { Headers } from 'node-mocks-http'
import { Subcategory } from '../../../src/entities/subcategory'
import {
    DeleteSubcategoryInput,
    UpdateSubcategoryInput,
} from '../../../src/types/graphQL/subcategory'

import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

const DELETE_SUBCATEGORY = `
    mutation deleteSubcategory($id: ID!) {
        subcategory(id: $id) {
            delete
        }
    }
`

export async function deleteSubcategory(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: DELETE_SUBCATEGORY,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlBool = res.data?.subcategory?.delete as boolean
    return gqlBool
}

export function buildSingleUpdateSubcategoryInput(
    id: string,
    name?: string
): UpdateSubcategoryInput {
    return {
        id,
        name,
    }
}

export function buildUpdateSubcategoryInputArray(
    ids: string[],
    avoidNames?: boolean
): UpdateSubcategoryInput[] {
    return Array.from(ids, (id, i) =>
        buildSingleUpdateSubcategoryInput(
            id,
            avoidNames ? undefined : `Modified Subcategory ${i + 1}`
        )
    )
}

export function buildDeleteSubcategoryInputArray(
    subcategories: Subcategory[]
): DeleteSubcategoryInput[] {
    return Array.from(subcategories, (s) => {
        return { id: s.id }
    })
}
