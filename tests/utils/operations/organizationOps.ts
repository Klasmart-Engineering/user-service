import { expect } from "chai";
import { Class } from "../../../src/entities/class";
import { Organization } from "../../../src/entities/organization";
import { OrganizationMembership } from "../../../src/entities/organizationMembership";
import { Role } from "../../../src/entities/role";
import { School } from "../../../src/entities/school";
import { User } from "../../../src/entities/user";
import { ApolloServerTestClient } from "../createTestClient";
import { AuthToken } from "../testConfig";

const CREATE_CLASS = `
    mutation myMutation(
            $organization_id: ID!
            $class_name: String) {
        organization(organization_id: $organization_id) {
            createClass(class_name: $class_name) {
                class_id
                class_name
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

export async function createClass(testClient: ApolloServerTestClient, organizationId: string) {
    const { mutate } = testClient;
    const className = "My Class";

    const res = await mutate({
        mutation: CREATE_CLASS,
        variables: { organization_id: organizationId, class_name: className },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
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

export async function createRole(testClient: ApolloServerTestClient, organizationId: string) {
    const { mutate } = testClient;
    const roleName = "My Class";

    const res = await mutate({
        mutation: CREATE_ROLE,
        variables: { organization_id: organizationId, role_name: roleName },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    return await Role.findOneOrFail({ where: { role_name: roleName } });
}

export async function createSchool(testClient: ApolloServerTestClient, organizationId: string) {
    const { mutate } = testClient;
    const schoolName = "My School";

    const res = await mutate({
        mutation: CREATE_SCHOOL,
        variables: { organization_id: organizationId, school_name: schoolName },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    return await School.findOneOrFail({ where: { school_name: schoolName } });
}

export async function addUserToOrganization(testClient: ApolloServerTestClient, userId: string, organizationId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_USER_TO_ORGANIZATION,
        variables: { user_id: userId, organization_id: organizationId },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    const dbUser = await User.findOneOrFail({ where: { user_id: userId } });
    const dbOrganization = await Organization.findOneOrFail({ where: { organization_id: organizationId } });
    const dbOrganizationMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId } });
    
    const organizationMembership = res.data?.user.addOrganization as OrganizationMembership;
    const userMemberships = await dbUser.memberships;
    const organizationMemberships = await dbOrganization.memberships;

    expect(organizationMembership).to.exist;
    expect(organizationMembership.user_id).equals(userId);
    expect(organizationMembership.organization_id).equals(organizationId);
    expect(userMemberships).to.deep.include(dbOrganizationMembership);
    expect(organizationMemberships).to.deep.include(dbOrganizationMembership);
}