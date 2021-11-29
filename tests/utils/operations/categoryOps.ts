import { Headers } from 'node-mocks-http'

import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

import { Subcategory } from '../../../src/entities/subcategory'
import { gql } from 'graphql-tag'
import { Category } from '../../../src/entities/category'
import {
    DeleteCategoryInput,
    UpdateCategoryInput,
} from '../../../src/types/graphQL/category'

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

const CATEGORY_FIELDS = gql`
    fragment categoryFields on CategoryConnectionNode {
        id
        name
        status
        system
    }
`

export const CATEGORY_NODE = gql`
    ${CATEGORY_FIELDS}

    query categoryNode($id: ID!) {
        categoryNode(id: $id) {
            ...categoryFields
        }
    }
`

export const CREATE_CATEGORIES = gql`
    ${CATEGORY_FIELDS}

    mutation createCategories($input: [CreateCategoryInput!]!) {
        createCategories(input: $input) {
            categories {
                ...categoryFields
            }
        }
    }
`

export const DELETE_CATEGORIES = gql`
    ${CATEGORY_FIELDS}

    mutation deleteCategories($input: [DeleteCategoryInput!]!) {
        deleteCategories(input: $input) {
            categories {
                ...categoryFields
            }
        }
    }
`

export const UPDATE_CATEGORIES = gql`
    ${CATEGORY_FIELDS}

    mutation UpdateCategories($input: [UpdateCategoryInput!]!) {
        updateCategories(input: $input) {
            categories {
                ...categoryFields
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

export function buildDeleteCategoryInputArray(
    categories: Category[]
): DeleteCategoryInput[] {
    return Array.from(categories, (c) => {
        return { id: c.id }
    })
}

export function buildSingleUpdateCategoryInput(
    id: string,
    name?: string,
    subcategories?: string[]
): UpdateCategoryInput {
    return {
        id,
        name,
        subcategories,
    }
}

export function buildUpdateCategoryInputArray(
    ids: string[],
    subcategories?: string[],
    avoidNames?: boolean
): UpdateCategoryInput[] {
    return Array.from(ids, (id, i) =>
        buildSingleUpdateCategoryInput(
            id,
            avoidNames ? undefined : `Modified Category ${i + 1}`,
            subcategories
        )
    )
}
