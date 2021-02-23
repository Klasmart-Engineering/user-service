import { expect } from "chai";
import { Class } from "../../../src/entities/class";
import { Organization } from "../../../src/entities/organization";
import { OrganizationMembership } from "../../../src/entities/organizationMembership";
import { Role } from "../../../src/entities/role";
import { School } from "../../../src/entities/school";
import { SchoolMembership } from "../../../src/entities/schoolMembership"
import { User } from "../../../src/entities/user";
import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken, generateToken } from "../testConfig";
import { Headers } from 'node-mocks-http';
import { gqlTry } from "../gqlTry";
import { userToPayload, userToSuperPayload } from "../../utils/operations/userOps"
import { utils } from "mocha";

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
            $role_name: String!,
            $role_description: String!) {
        organization(organization_id: $organization_id) {
            createRole(role_name: $role_name, role_description: $role_description) {
                role_id
                role_name
                role_description
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
                status
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

const DELETE_ORGANIZATION = `
    mutation myMutation($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            delete
        }
    }
`;

const INVITE_USER = `
    mutation myMutation($organization_id: ID!, $email:String, $phone: String, $given_name: String, $family_name: String, $date_of_birth: String, $username: String, $organization_role_ids: [ID!], $school_ids:[ID!] , $school_role_ids:[ID!] ) {
        organization(organization_id: $organization_id) {
            inviteUser(email: $email, phone:$phone, given_name: $given_name, family_name:$family_name, date_of_birth:$date_of_birth, username: $username, organization_role_ids:$organization_role_ids, school_ids:$school_ids, school_role_ids:$school_role_ids){
                user{
                    user_id
                    email
                    phone
                    given_name
                    family_name
                    date_of_birth
                    avatar
                    username
                }
                membership{
                    user_id
                    organization_id
                    join_timestamp
                }
                schoolMemberships{
                    user_id
                    school_id
                    join_timestamp
                }
            }
        }
    }
`;

const EDIT_MEMBERSHIP = `
    mutation myMutation($organization_id: ID!, $email:String, $phone: String, $given_name: String, $family_name: String, $date_of_birth: String, $username: String, $organization_role_ids: [ID!], $school_ids:[ID!] , $school_role_ids:[ID!] ) {
        organization(organization_id: $organization_id) {
            editMembership(email: $email, phone:$phone, given_name: $given_name, family_name:$family_name,  date_of_birth:$date_of_birth, username: $username, organization_role_ids:$organization_role_ids, school_ids:$school_ids, school_role_ids:$school_role_ids){
                user{
                    user_id
                    email
                    phone
                    given_name
                    family_name
                    date_of_birth
                    avatar
                    username
                }
                membership{
                    user_id
                    organization_id
                    join_timestamp
                }
                schoolMemberships{
                    user_id
                    school_id
                    join_timestamp
                }
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

export async function createRole(testClient: ApolloServerTestClient, organizationId: string, roleName?: string, roleDescription?: string, token?:string) {
    const { mutate } = testClient;
    roleName = roleName ?? "My Role";
    roleDescription = roleDescription ?? "My Role Description";
    if(token === undefined){
        token = JoeAuthToken
    }
    const operation = () => mutate({
        mutation: CREATE_ROLE,
        variables: { organization_id: organizationId, role_name: roleName, role_description: roleDescription },
        headers: { authorization: token },
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
export async function inviteUser(testClient: ApolloServerTestClient, organizationId: string, email?: string, phone?: string, given_name?: string, family_name?: string, date_of_birth?: string, username?: string, organization_role_ids?: string[], school_ids?: string[], school_role_ids?: string[], headers?: Headers) {
    const { mutate } = testClient;
    let variables: any
    variables = { organization_id:organizationId}
    if (email !== undefined){
        variables.email = email
    }
    if (phone !== undefined){
        variables.phone = phone
    }
    if (given_name !== undefined){
        variables.given_name = given_name
    }
    if (family_name !== undefined){
        variables.family_name = family_name
    }
    if (date_of_birth !== undefined){
        variables.date_of_birth = date_of_birth
    }
    if (username !== undefined){
       variables.username = username
    }
    if (organization_role_ids !== undefined){
        variables.organization_role_ids = organization_role_ids
    }
    if (school_ids !== undefined){
        variables.school_ids = school_ids
    }
    if(school_role_ids !== undefined){
        variables.school_role_ids = school_role_ids
    }

    const operation = () => mutate({
        mutation: INVITE_USER,
        variables: variables,
        headers: headers,
    });

    const res = await gqlTry(operation);
    const result = res.data?.organization.inviteUser as {user:User,membership: OrganizationMembership,schoolMemberships: SchoolMembership[]}
    return result
}

export async function editMembership(testClient: ApolloServerTestClient, organizationId: string, email?: string, phone?: string,  given_name?: string, family_name?: string ,date_of_birth?: string, username?: string, organization_role_ids?: string[], school_ids?: string[], school_role_ids?: string[], headers?: Headers) {
    const { mutate } = testClient;
    let variables: any
    variables = { organization_id:organizationId}
    if (email !== undefined){
        variables.email = email
    }
    if (phone !== undefined){
        variables.phone = phone
    }
    if (given_name !== undefined){
        variables.given_name = given_name
    }
    if (family_name !== undefined){
        variables.family_name = family_name
    }
    if (date_of_birth !== undefined){
        variables.date_of_birth = date_of_birth
    }
    if (username !== undefined){
        variables.username = username
    }
    if (organization_role_ids !== undefined){
        variables.organization_role_ids = organization_role_ids
    }
    if (school_ids !== undefined){
        variables.school_ids = school_ids
    }
    if(school_role_ids !== undefined){
        variables.school_role_ids = school_role_ids
    }

    const operation = () => mutate({
        mutation: EDIT_MEMBERSHIP,
        variables: variables,
        headers: headers,
    });

    const res = await gqlTry(operation);
    const result = res.data?.organization.editMembership as {user:User,membership: OrganizationMembership,schoolMemberships: SchoolMembership[]}
    return result
}

export async function deleteOrganization(testClient: ApolloServerTestClient, organizationId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_ORGANIZATION,
        variables: { organization_id: organizationId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlOrganization = res.data?.organization.delete as boolean;
    return gqlOrganization;
}


