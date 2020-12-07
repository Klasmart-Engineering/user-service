import { ApolloServerTestClient } from "../createTestClient";
import { Headers } from "node-mocks-http"
import { gqlTry } from "../gqlTry";
import { SchoolMembership } from "../../../src/entities/schoolMembership";
import { School } from "../../../src/entities/school";
import { Organization } from "../../../src/entities/organization";
import { Class } from "../../../src/entities/class";

const GET_ORGANIZATION = `
    query myQuery($school_id: ID!) {
        school(school_id: $school_id) {
            organization {
                organization_id
                organization_name
            }
        }
    }
`;

const GET_CLASSES = `
    query myQuery($school_id: ID!) {
        school(school_id: $school_id) {
            classes {
                class_id
                class_name
            }
        }
    }
`;

const GET_MEMBERSHIPS = `
    query myQuery($school_id: ID!) {
        school(school_id: $school_id) {
            memberships {
                user_id
                school_id
            }
        }
    }
`;

const GET_MEMBERSHIP = `
    query myQuery(
            $school_id: ID!
            $user_id: ID!) {
        school(school_id: $school_id) {
            membership(user_id: $user_id) {
                user_id
                school_id
            }
        }
    }
`;

const UPDATE_SCHOOL = `
    mutation myMutation(
            $school_id: ID!
            $school_name: String) {
        school(school_id: $school_id) {
            set(school_name: $school_name) {
                school_id
                school_name
            }
        }
    }
`;

const ADD_USER_TO_SCHOOL = `
    mutation myMutation(
            $user_id: ID!
            $school_id: ID!) {
        school(school_id: $school_id) {
            addUser(user_id: $user_id) {
                user_id
                school_id
            }
        }
    }
`;

export async function getSchoolOrganization(testClient: ApolloServerTestClient, schoolId: string, headers?: Headers) {
    const { query } = testClient;
    
    const operation = () => query({
        query: GET_ORGANIZATION,
        variables: { school_id: schoolId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlOrganization = res.data?.school.organization as Organization;
    return gqlOrganization;
}

export async function getSchoolClasses(testClient: ApolloServerTestClient, schoolId: string, headers?: Headers) {
    const { query } = testClient;
    
    const operation = () => query({
        query: GET_CLASSES,
        variables: { school_id: schoolId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlClasses = res.data?.school.classes as Class[];
    return gqlClasses;
}

export async function getSchoolMembershipsViaSchool(testClient: ApolloServerTestClient, schoolId: string, headers?: Headers) {
    const { query } = testClient;
    
    const operation = () => query({
        query: GET_MEMBERSHIPS,
        variables: { school_id: schoolId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMemberships = res.data?.school.memberships as SchoolMembership[];
    return gqlMemberships;
}

export async function getSchoolMembershipViaSchool(testClient: ApolloServerTestClient, schoolId: string, userId: string, headers?: Headers) {
    const { query } = testClient;
    
    const operation = () => query({
        query: GET_MEMBERSHIP,
        variables: { school_id: schoolId, user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMembership = res.data?.school.membership as SchoolMembership;
    return gqlMembership;
}

export async function updateSchool(testClient: ApolloServerTestClient, schoolId: string, schoolName: string, headers?: Headers) {
    const { mutate } = testClient;
    
    const operation = () => mutate({
        mutation: UPDATE_SCHOOL,
        variables: { school_id: schoolId, school_name: schoolName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlSchool = res.data?.school.set as School;
    return gqlSchool;
}

export async function addUserToSchool(testClient: ApolloServerTestClient, userId: string, schoolId: string, headers?: Headers) {
    const { mutate } = testClient;
    
    const operation = () => mutate({
        mutation: ADD_USER_TO_SCHOOL,
        variables: { user_id: userId, school_id: schoolId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMembership = res.data?.school.addUser as SchoolMembership;
    return gqlMembership;
}