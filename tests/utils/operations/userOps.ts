import { expect } from "chai";
import { Class } from "../../../src/entities/class";
import { Organization } from "../../../src/entities/organization";
import { OrganizationMembership } from "../../../src/entities/organizationMembership";
import { SchoolMembership } from "../../../src/entities/schoolMembership";
import { User } from "../../../src/entities/user";
import { ApolloServerTestClient } from "../createTestClient";
import { gqlTry } from "../gqlTry";
import { JoeAuthToken } from "../testConfig";
import { Headers } from 'node-mocks-http';

const CREATE_ORGANIZATION = `
    mutation myMutation($user_id: ID!, $organization_name: String) {
        user(user_id: $user_id) {
            createOrganization(organization_name: $organization_name) {
                organization_id
                organization_name
                status
            }
        }
    }
`;

const ADD_ORGANIZATION_TO_USER = `
    mutation myMutation($user_id: ID!, $organization_id: ID!) {
        user(user_id: $user_id) {
            addOrganization(organization_id: $organization_id) {
                user_id
                organization_id
            }
        }
    }
`;

const SET = `
    mutation myMutation(
            $user_id: ID!
            $given_name: String,
            $family_name: String,
            $avatar: String) {
        user(user_id: $user_id) {
            set(
                given_name: $given_name
                family_name: $family_name
                avatar: $avatar
            ) {
                given_name
                family_name
                avatar
            }
        }
    }
`;

const GET_ORGANIZATION_MEMBERSHIPS = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            memberships {
                user_id
                organization_id
            }
        }
    }
`;

const GET_ORGANIZATION_MEMBERSHIP = `
    query myQuery(
            $user_id: ID!,
            $organization_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                user_id
                organization_id
            }
        }
    }
`;

const GET_SCHOOL_MEMBERSHIPS = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            school_memberships {
                user_id
                school_id
            }
        }
    }
`;

const GET_SCHOOL_MEMBERSHIP = `
    query myQuery(
            $user_id: ID!,
            $school_id: ID!) {
        user(user_id: $user_id) {
            school_membership(school_id: $school_id) {
                user_id
                school_id
            }
        }
    }
`;

const GET_CLASSES_TEACHING = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            classesTeaching {
                class_id
            }
        }
    }
`;

const GET_CLASSES_STUDYING = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            classesStudying {
                class_id
            }
        }
    }
`;

const GET_SCHOOL_MEMBERSHIPS_WITH_PERMISSION = `
    query myQuery($user_id: ID!, $permission_name: String!) {
        user(user_id: $user_id) {
            schoolsWithPermission(permission_name: $permission_name) {
                user_id
                school_id
            }
        }
    }
`;

const MERGE_USER = `
mutation myMutation($user_id: ID!, $other_id: String) {
    user(user_id: $user_id) {
        merge(other_id: $other_id) {
            user_id
            given_name
            family_name
            avatar
            memberships{
                user_id
                organization_id
            }
            school_memberships{
                user_id
                school_id
            }
            classesStudying{
                class_id
            }
            classesTeaching{
                class_id
            }
        }
    }
}
`;

export async function createOrganizationAndValidate(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationName?: string,
    token?: string
): Promise<Organization> {
    organizationName = organizationName ?? "My Organization";
    const gqlOrganization = await createOrganization(testClient, userId, organizationName,token)

    expect(gqlOrganization).to.exist;
    const dbOrganization = await Organization.findOneOrFail({ where: { organization_name: organizationName } });
    expect(dbOrganization).to.include(gqlOrganization);

    return dbOrganization;
}

export async function createOrganization(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationName: string,
    token?: string
): Promise<Organization> {

    token = token ?? JoeAuthToken

    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: CREATE_ORGANIZATION,
        variables: { user_id: userId, organization_name: organizationName },
        headers: { authorization: token },
    });

    const res = await gqlTry(operation);
    const gqlOrganization = res.data?.user.createOrganization as Organization;
    return gqlOrganization;
}

export async function addOrganizationToUserAndValidate(testClient: ApolloServerTestClient, userId: string, organizationId: string, token?: string) {
    const gqlMembership = await addOrganizationToUser(testClient, userId, organizationId, token);

    const dbUser = await User.findOneOrFail({ where: { user_id: userId } });
    const dbOrganization = await Organization.findOneOrFail({ where: { organization_id: organizationId } });
    const dbOrganizationMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId, organization_id: organizationId } });

    const userMemberships = await dbUser.memberships;
    const organizationMemberships = await dbOrganization.memberships;

    expect(gqlMembership).to.exist;
    expect(gqlMembership.user_id).equals(userId);
    expect(gqlMembership.organization_id).equals(organizationId);
    expect(userMemberships).to.deep.include(dbOrganizationMembership);
    expect(organizationMemberships).to.deep.include(dbOrganizationMembership);

    return gqlMembership;
}

export async function addOrganizationToUser(testClient: ApolloServerTestClient, userId: string, organizationId: string, token?: string) {
    const { mutate } = testClient;

    token = token ?? JoeAuthToken;

    const operation = () => mutate({
        mutation: ADD_ORGANIZATION_TO_USER,
        variables: { user_id: userId, organization_id: organizationId },
        headers: { authorization: token },
    });

    const res = await gqlTry(operation);
    const gqlMembership = res.data?.user.addOrganization as OrganizationMembership;
    return gqlMembership;
}

export async function updateUser(testClient: ApolloServerTestClient, user: User, headers?: Headers) {
    const { mutate } = testClient;
    const userMods = {
        given_name: "Billy",
        family_name: "Bob",
        avatar: "new_avatar",
    };

    const operation = () => mutate({
        mutation: SET,
        variables: { user_id: user.user_id, ...userMods },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.user.set as User;
    return gqlUser;
}

export async function getOrganizationMemberships(testClient: ApolloServerTestClient, user: User, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_ORGANIZATION_MEMBERSHIPS,
        variables: { user_id: user.user_id },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMemberships = res.data?.user.memberships as OrganizationMembership[];
    return gqlMemberships;
}

export async function getOrganizationMembership(testClient: ApolloServerTestClient, userId: string, organizationId: string, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_ORGANIZATION_MEMBERSHIP,
        variables: { user_id: userId, organization_id: organizationId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMembership = res.data?.user.membership as OrganizationMembership;
    return gqlMembership;
}

export async function getSchoolMemberships(testClient: ApolloServerTestClient, userId: string, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_SCHOOL_MEMBERSHIPS,
        variables: { user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMemberships = res.data?.user.school_memberships as SchoolMembership[];
    return gqlMemberships;
}

export async function getSchoolMembership(testClient: ApolloServerTestClient, userId: string, schoolId: string, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_SCHOOL_MEMBERSHIP,
        variables: { user_id: userId, school_id: schoolId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMembership = res.data?.user.school_membership as SchoolMembership;
    return gqlMembership;
}

export async function getClassesTeaching(testClient: ApolloServerTestClient, userId: string, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_CLASSES_TEACHING,
        variables: { user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlClasses = res.data?.user.classesTeaching as Class[];
    return gqlClasses;
}

export async function getClassesStudying(testClient: ApolloServerTestClient, userId: string, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_CLASSES_STUDYING,
        variables: { user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlClasses = res.data?.user.classesStudying as Class[];
    return gqlClasses;
}

export async function getUserSchoolMembershipsWithPermission(testClient: ApolloServerTestClient, userId: string, permissionName: string, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_SCHOOL_MEMBERSHIPS_WITH_PERMISSION,
        variables: { user_id: userId, permission_name: permissionName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMemberships = res.data?.user.schoolsWithPermission as SchoolMembership[];
    return gqlMemberships;
}

export async function mergeUser(testClient: ApolloServerTestClient, userId: string, otherId: string, headers?: Headers){
    const { mutate } = testClient;

    headers = headers ?? { authorization: JoeAuthToken };
    console.log("userId:",userId,"otherId:",otherId)
    const operation = () => mutate({
        mutation: MERGE_USER,
        variables: { user_id: userId, other_id: otherId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.user.merge as User;
    return gqlUser;
}
