import { expect } from "chai";
import { SchoolMembership } from "../../../src/entities/schoolMembership";
import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken } from "../testConfig";

const ADD_ROLE_TO_ORGANIZATION_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $organization_id: ID!
            $role_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                addRole(role_id: $role_id) {
                    role_id
                    role_name
                }
            }
        }
    }
`;

const GET_SCHOOL_MEMBERSHIPS = `
    query myQuery(
            $user_id: ID!
            $organization_id: ID!) {
        user(user_id: $user_id) {
            membership(organization_id: $organization_id) {
                schoolMemberships {
                    school_id
                    school {
                        school_name
                    }
                }
            }
        }
    }
`;

export async function addRoleToOrganizationMembership(testClient: ApolloServerTestClient, userId: string, organizationId: string, roleId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_ROLE_TO_ORGANIZATION_MEMBERSHIP,
        variables: { user_id: userId, organization_id: organizationId, role_id: roleId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
}

export async function getSchoolMembershipsForOrganizationMembership(testClient: ApolloServerTestClient, userId: string, organizationId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: GET_SCHOOL_MEMBERSHIPS,
        variables: { user_id: userId, organization_id: organizationId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.map(x => x.message).toString()).to.be.undefined;

    return res.data?.user.membership.schoolMemberships as SchoolMembership[];
}