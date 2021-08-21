import supertest from 'supertest'
import { AgeRangeUnit } from '../../../../src/entities/ageRangeUnit'
import { DELETE_CATEGORY } from '../categoryOps'
import {
    ADD_SCHOOL_TO_CLASS,
    EDIT_AGE_RANGE_CLASS,
    EDIT_GRADES_CLASS,
    EDIT_PROGRAM_CLASS,
    EDIT_SCHOOLS_IN_CLASS,
    EDIT_STUDENTS_IN_CLASS,
    EDIT_SUBJECTS_CLASS,
} from '../classOps'
import { LEAVE_ORGANIZATION } from '../organizationMembershipOps'
import {
    CREATE_CLASS,
    CREATE_OR_UPDATE_AGE_RANGES,
    CREATE_OR_UPDATE_CATEGORIES,
    CREATE_OR_UPDATE_GRADES,
    CREATE_OR_UPDATE_PROGRAMS,
    CREATE_OR_UPDATE_SUBCATEGORIES,
    CREATE_OR_UPDATE_SUBJECTS,
    CREATE_SCHOOL,
    INVITE_USER,
} from '../organizationOps'
import { CREATE_ORGANIZATION } from '../userOps'

export interface IProgramDetail {
    name?: string
    age_ranges?: string[]
    subjects?: string[]
}

export interface IAgeRangeDetail {
    name?: string
    low_value?: number
    low_value_unit?: AgeRangeUnit
    high_value?: number
    high_value_unit?: AgeRangeUnit
}

export interface IGradeDetail {
    id?: string
    name?: string
    progress_from_grade_id?: string
    progress_to_grade_id?: string
    system?: string
}

export interface ISubjectDetail {
    id?: string
    name?: string
    categories?: string[]
    system?: boolean
}

export interface ISubcategoryDetail {
    id?: string
    name?: string
    system?: boolean
}

export interface ICategoryDetail {
    id?: string
    name?: string
    subcategories?: string[]
    system?: boolean
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
    token: string,
    organization_role_ids?: string[],
    school_role_ids?: string[],
    school_ids?: string[]
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
                organization_role_ids,
                school_role_ids,
                school_ids,
            },
        })
}

export async function createSchool(
    organization_id: string,
    school_name: string,
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_SCHOOL,
            variables: {
                organization_id,
                school_name,
            },
        })
}

export async function addSchoolToClass(
    class_id: string,
    school_id: string,
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: ADD_SCHOOL_TO_CLASS,
            variables: {
                class_id,
                school_id,
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

export async function createGrades(
    organization_id: string,
    grades: IGradeDetail[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_OR_UPDATE_GRADES,
            variables: {
                organization_id,
                grades,
            },
        })
}

export async function createSubjects(
    organization_id: string,
    subjects: ISubjectDetail[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_OR_UPDATE_SUBJECTS,
            variables: {
                organization_id,
                subjects,
            },
        })
}

export async function addAgeRangesToClass(
    class_id: string,
    age_range_ids: string[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: EDIT_AGE_RANGE_CLASS,
            variables: {
                id: class_id,
                age_range_ids,
            },
        })
}

export async function addSchoolsToClass(
    class_id: string,
    school_ids: string[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: EDIT_SCHOOLS_IN_CLASS,
            variables: {
                class_id,
                school_ids,
            },
        })
}

export async function addGradesToClass(
    class_id: string,
    grade_ids: string[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: EDIT_GRADES_CLASS,
            variables: {
                id: class_id,
                grade_ids,
            },
        })
}

export async function addSubjectsToClass(
    class_id: string,
    subject_ids: string[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: EDIT_SUBJECTS_CLASS,
            variables: {
                id: class_id,
                subject_ids,
            },
        })
}

export async function createSubcategories(
    organization_id: string,
    subcategories: ISubcategoryDetail[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_OR_UPDATE_SUBCATEGORIES,
            variables: {
                organization_id,
                subcategories,
            },
        })
}

export async function createCategories(
    organization_id: string,
    categories: ICategoryDetail[],
    token: string
) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_OR_UPDATE_CATEGORIES,
            variables: {
                organization_id,
                categories,
            },
        })
}

export async function deleteCategory(id: string, token: string) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: DELETE_CATEGORY,
            variables: {
                id,
            },
        })
}
