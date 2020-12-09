import { expect } from "chai";
import { Class } from "../../../src/entities/class";
import { Organization } from "../../../src/entities/organization";
import { OrganizationMembership } from "../../../src/entities/organizationMembership";
import { Role } from "../../../src/entities/role";
import { School } from "../../../src/entities/school";
import { User } from "../../../src/entities/user";
import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken } from "../testConfig";
import { Headers } from 'node-mocks-http';
import { gqlTry } from "../gqlTry";

const CREATE_CLASS = `
    mutation myMutation(
            $organization_id: ID!
            $class_name: String) {
        organization(organization_id: $organization_id) {
            createClass(class_name: $class_name) {
                class_id
                class_name
                status
            }
        }
    }
`;

const CREATE_ROLE = `
    mutation myMutation(
            $organization_id: ID!
            $role_name: String) {
        organization(organization_id: $organization_id) {
            createRole(role_name: $role_name) {
                role_id
                role_name
            }
        }
    }
`;

const CREATE_SCHOOL = `
    mutation myMutation(
            $organization_id: ID!
            $school_name: String) {
        organization(organization_id: $organization_id) {
            createSchool(school_name: $school_name) {
                school_id
                school_name
            }
        }
    }
`;

const ADD_USER_TO_ORGANIZATION = `
    mutation myMutation($user_id: ID!, $organization_id: ID!) {
        organization(organization_id: $organization_id) {
            addUser(user_id: $user_id) {
                user_id
                organization_id
            }
        }
    }
`;

export async function createClass(testClient: ApolloServerTestClient, organizationId: string, className?: string, headers?: Headers) {
    const { mutate } = testClient;
    className = className ?? "My Class";
    headers = headers ?? { authorization: JoeAuthToken };

    const operation = () => mutate({
        mutation: CREATE_CLASS,
        variables: { organization_id: organizationId, class_name: className },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlClass = res.data?.organization.createClass as Class;
    return gqlClass;
}

export async function createClassAndValidate(testClient: ApolloServerTestClient, organizationId: string) {
    const gqlClass = await createClass(testClient, organizationId);
    const dbClass = await Class.findOneOrFail({ where: { class_id: gqlClass.class_id } });
    const organization = await dbClass.organization;
    expect(dbClass.class_name).equals(gqlClass.class_name);
    expect(organization?.organization_id).equals(organizationId);
    return gqlClass;
}

export async function createRole(testClient: ApolloServerTestClient, organizationId: string, roleName?: string) {
    const { mutate } = testClient;
    roleName = roleName ?? "My Role";

    const operation = () => mutate({
        mutation: CREATE_ROLE,
        variables: { organization_id: organizationId, role_name: roleName },
        headers: { authorization: JoeAuthToken },
    });

    const res = await gqlTry(operation);
    const gqlRole = res.data?.organization.createRole as Role;
    return gqlRole;
}

export async function createSchool(testClient: ApolloServerTestClient, organizationId: string, schoolName?: string, headers?: Headers) {
    const { mutate } = testClient;
    schoolName = schoolName ?? "My School";

    const operation = () => mutate({
        mutation: CREATE_SCHOOL,
        variables: { organization_id: organizationId, school_name: schoolName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlSchool = res.data?.organization.createSchool as School;
    return gqlSchool;
}

export async function addUserToOrganizationAndValidate(testClient: ApolloServerTestClient, userId: string, organizationId: string, headers?: Headers) {
    const gqlMembership = await addUserToOrganization(testClient, userId, organizationId, headers);

    const dbUser = await User.findOneOrFail({ where: { user_id: userId } });
    const dbOrganization = await Organization.findOneOrFail({ where: { organization_id: organizationId } });
    const dbOrganizationMembership = await OrganizationMembership.findOneOrFail({ where: { organization_id: organizationId, user_id: userId } });

    const userMemberships = await dbUser.memberships;
    const organizationMemberships = await dbOrganization.memberships;

    expect(gqlMembership).to.exist;
    expect(gqlMembership.user_id).equals(userId);
    expect(gqlMembership.organization_id).equals(organizationId);
    expect(userMemberships).to.deep.include(dbOrganizationMembership);
    expect(organizationMemberships).to.deep.include(dbOrganizationMembership);
}

export async function addUserToOrganization(testClient: ApolloServerTestClient, userId: string, organizationId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: ADD_USER_TO_ORGANIZATION,
        variables: { user_id: userId, organization_id: organizationId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlMembership = res.data?.organization.addUser as OrganizationMembership;
    return gqlMembership;
}
