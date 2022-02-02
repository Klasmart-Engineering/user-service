import { Headers } from 'node-mocks-http'

import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

import { AgeRange } from '../../../src/entities/ageRange'
import { Grade } from '../../../src/entities/grade'
import { Subject } from '../../../src/entities/subject'
import { gql } from 'graphql-tag'

const DELETE_PROGRAM = `
    mutation deleteProgram($id: ID!) {
        program(id: $id) {
            delete
        }
    }
`

const EDIT_AGE_RANGES_PROGRAM = `
    mutation editAgeRangeProgram($id: ID!, $age_range_ids: [ID!]) {
       program(id: $id) {
          editAgeRanges(age_range_ids: $age_range_ids) {
            id
            name
          }
       }
    }
`

const EDIT_GRADES_PROGRAM = `
    mutation editGradeProgram($id: ID!, $grade_ids: [ID!]) {
       program(id: $id) {
          editGrades(grade_ids: $grade_ids) {
            id
            name
          }
       }
    }
`

const EDIT_SUBJECT_PROGRAM = `
    mutation editSubjectProgram($id: ID!, $subject_ids: [ID!]) {
       program(id: $id) {
          editSubjects(subject_ids: $subject_ids) {
            id
            name
          }
       }
    }
`

const PROGRAMS_MUTATION_OUTPUT = `
    programs {
        id
        name
        status
        system
    }
`

export const CREATE_PROGRAMS = gql`
    mutation CreatePrograms($input: [CreateProgramInput!]!) {
        createPrograms(input: $input) {
            ${PROGRAMS_MUTATION_OUTPUT}
        }
    }
`

export const UPDATE_PROGRAMS = gql`
    mutation UpdatePrograms($input: [UpdateProgramInput!]!) {
        updatePrograms(input: $input) {
            ${PROGRAMS_MUTATION_OUTPUT}
        }
    }
`

export const DELETE_PROGRAMS = gql`
    mutation DeletePrograms($input: [DeleteProgramInput!]!) {
        deletePrograms(input: $input) {
            ${PROGRAMS_MUTATION_OUTPUT}
        }
    }
`

export async function deleteProgram(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: DELETE_PROGRAM,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlBool = res.data?.program?.delete as boolean
    return gqlBool
}

export async function editAgeRanges(
    testClient: ApolloServerTestClient,
    id: string,
    age_range_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_AGE_RANGES_PROGRAM,
            variables: { id: id, age_range_ids: age_range_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlAgeRanges = res.data?.program?.editAgeRanges as AgeRange[]
    return gqlAgeRanges
}

export async function editGrades(
    testClient: ApolloServerTestClient,
    id: string,
    grade_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_GRADES_PROGRAM,
            variables: { id: id, grade_ids: grade_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlGrades = res.data?.program?.editGrades as Grade[]
    return gqlGrades
}

export async function editSubjects(
    testClient: ApolloServerTestClient,
    id: string,
    subject_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_SUBJECT_PROGRAM,
            variables: { id: id, subject_ids: subject_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubjects = res.data?.program?.editSubjects as Subject[]
    return gqlSubjects
}
