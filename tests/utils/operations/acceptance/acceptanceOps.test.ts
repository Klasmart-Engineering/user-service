import supertest from 'supertest'
import { AgeRangeUnit } from '../../../../src/entities/ageRangeUnit'
import { EDIT_PROGRAM_CLASS, EDIT_STUDENTS_IN_CLASS } from '../classOps'
import { MY_USERS } from '../modelOps'
import { LEAVE_ORGANIZATION } from '../organizationMembershipOps'
import {
    CREATE_CLASS,
    CREATE_OR_UPDATE_AGE_RANGES,
    CREATE_OR_UPDATE_PROGRAMS,
    INVITE_USER,
} from '../organizationOps'
import { CREATE_ORGANIZATION } from '../userOps'

export interface IProgramDetail {
    name: string
    age_ranges: string[]
}

export interface IAgeRangeDetail {
    name: string
    low_value: number
    low_value_unit: AgeRangeUnit
    high_value: number
    high_value_unit: AgeRangeUnit
}

const url = 'http://localhost:8080'
const request = supertest(url)

export async function createOrg(
    user_id: string,
    org_name: string,
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_ORGANIZATION,
            variables: {
                user_id,
                org_name,
            },
        })
}

export async function createAgeRanges(
    organization_id: string,
    age_ranges: IAgeRangeDetail[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_OR_UPDATE_AGE_RANGES,
            variables: {
                organization_id,
                age_ranges,
            },
        })
}

export async function addProgramsToClass(
    class_id: string,
    program_ids: string[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: EDIT_PROGRAM_CLASS,
            variables: {
                id: class_id,
                program_ids,
            },
        })
}

export async function createPrograms(
    organization_id: string,
    programs: IProgramDetail[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_OR_UPDATE_PROGRAMS,
            variables: {
                organization_id,
                programs,
            },
        })
}

export async function createClass(
    organization_id: string,
    class_name: string,
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_CLASS,
            variables: {
                organization_id,
                class_name,
            },
        })
}

export async function addStudentsToClass(
    class_id: string,
    student_ids: string[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: EDIT_STUDENTS_IN_CLASS,
            variables: {
                class_id,
                student_ids,
            },
        })
}

export async function inviteUserToOrganization(
    given_name: string,
    family_name: string,
    email: string,
    organization_id: string,
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: INVITE_USER,
            variables: {
                given_name,
                family_name,
                email,
                organization_id,
            },
        })
}

export async function leaveTheOrganization(
    user_id: string,
    organization_id: string,
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: LEAVE_ORGANIZATION,
            variables: {
                user_id,
                organization_id,
            },
        })
}
