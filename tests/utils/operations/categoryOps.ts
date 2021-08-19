import { Headers } from 'node-mocks-http'

import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

import { Subcategory } from '../../../src/entities/subcategory'

const DELETE_SUBCATEGORY = `
    mutation deleteCategory($id: ID!) {
        category(id: $id) {
            delete
        }
    }
`

const EDIT_SUBCATEGORIES = `
    mutation editSubcategories($id: ID!, $subcategory_ids: [ID!]) {
       category(id: $id) {
          editSubcategories(subcategory_ids: $subcategory_ids) {
            id
            name
          }
       }
    }
`

export async function editSubcategories(
    testClient: ApolloServerTestClient,
    id: string,
    subcategory_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_SUBCATEGORIES,
            variables: { id: id, subcategory_ids: subcategory_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubcategories = res.data?.category
        ?.editSubcategories as Subcategory[]
    return gqlSubcategories
}

export async function deleteCategory(
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
    const gqlBool = res.data?.category?.delete as boolean
    return gqlBool
}
