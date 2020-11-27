import { expect } from "chai";
import { Class } from "../../../src/entities/class";
import { Organization } from "../../../src/entities/organization";
import { OrganizationMembership } from "../../../src/entities/organizationMembership";
import { SchoolMembership } from "../../../src/entities/schoolMembership";
import { User } from "../../../src/entities/user";
import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken } from "../testConfig";

const CREATE_ORGANIZATION = `
    mutation myMutation(
        $user_id: ID!, 
        $organization_name: String,
        $address1: String,
        $address2: String,
        $email: String
        $shortCode: String
        $phone: String
        $color: String
        ) {
            user(user_id: $user_id) {
                createOrganization(
                    organization_name: $organization_name
                    address1: $address1
                    address2: $address2
                    email: $email
                    shortCode: $shortCode
                    phone: $phone
                    color: $color
                ) {
                    organization_id
                    organization_name
                    email
                    address1
                    phone
                    shortCode
                    color
                    logo
                    errors {
                        property
                        value
                        constraint
                    }
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
            $given_name: String
            $family_name: String) {
        user(user_id: $user_id) {
            set(
                given_name: $given_name
                family_name: $family_name
            ) {
                given_name
                family_name
                avatar
                birth_year_month
                errors {
                    property
                    value
                    constraint
                }
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

export async function createOrganization(
    testClient: ApolloServerTestClient,
    userId: string,
    organizationName?: string,
    email?: string,
    shortCode?: string,
    phone?: string,
    address1?: string,
    address2?: string,
    color?: string
): Promise<Organization> {
    const { mutate } = testClient;
    organizationName = organizationName ?? "My Organization";
    address1 = address1 ?? "Known street 10 known city";
    address2 = address2 ?? undefined;
    email = email ?? "myorganization@mail.net";
    shortCode = shortCode ?? "ABCDE000";
    phone = phone ?? "2223336666";
    color = color ?? "ffffff";

    const orgVars = { 
        user_id: userId, 
        organization_name: organizationName,
        address1: address1,
        address2: address2,
        email: email,
        shortCode: shortCode,
        phone: phone,
        color: color
    }

    const res = await mutate({
        mutation: CREATE_ORGANIZATION,
        variables: orgVars,
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    expect(res.data?.user.createOrganization.errors).to.be.null;

    const gqlOrganization = res.data?.user.createOrganization as Organization;
    expect(gqlOrganization).to.exist;

    const dbOrganization = await Organization.findOneOrFail({ where: { organization_name: organizationName } });
    const genericOrg = JSON.parse(JSON.stringify(dbOrganization))
    genericOrg.logo = ''
    genericOrg.errors = null

    expect(genericOrg).to.include(gqlOrganization);

    return dbOrganization;
}

export async function addOrganizationToUser(testClient: ApolloServerTestClient, userId: string, organizationId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_ORGANIZATION_TO_USER,
        variables: { user_id: userId, organization_id: organizationId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    const dbUser = await User.findOneOrFail({ where: { user_id: userId } });
    const dbOrganization = await Organization.findOneOrFail({ where: { organization_id: organizationId } });
    const dbOrganizationMembership = await OrganizationMembership.findOneOrFail({ where: { user_id: userId } });
    
    const gqlMembership = res.data?.user.addOrganization as OrganizationMembership;
    const userMemberships = await dbUser.memberships;
    const organizationMemberships = await dbOrganization.memberships;

    expect(gqlMembership).to.exist;
    expect(gqlMembership.user_id).equals(userId);
    expect(gqlMembership.organization_id).equals(organizationId);
    expect(userMemberships).to.deep.include(dbOrganizationMembership);
    expect(organizationMemberships).to.deep.include(dbOrganizationMembership);
    return gqlMembership;
}

export async function updateUser(testClient: ApolloServerTestClient, user: User) {
    const { mutate } = testClient;
    const userMods = {
        user_id: user.user_id,
        given_name: "Billy",
        family_name: "Bob"
    };

    const res = await mutate({
        mutation: SET,
        variables: userMods,
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    expect(res.data?.user.set.errors).to.be.null;
    const gqlUser = res.data?.user.set as User;
    return gqlUser;
}

export async function getOrganizationMemberships(testClient: ApolloServerTestClient, user: User) {
    const { query } = testClient;
    
    const res = await query({
        query: GET_ORGANIZATION_MEMBERSHIPS,
        variables: { user_id: user.user_id },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlMemberships = res.data?.user.memberships as OrganizationMembership[];
    return gqlMemberships;
}

export async function getOrganizationMembership(testClient: ApolloServerTestClient, userId: string, organizationId: string) {
    const { query } = testClient;

    const res = await query({
        query: GET_ORGANIZATION_MEMBERSHIP,
        variables: { user_id: userId, organization_id: organizationId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlMembership = res.data?.user.membership as OrganizationMembership;
    return gqlMembership;
}

export async function getSchoolMemberships(testClient: ApolloServerTestClient, userId: string) {
    const { query } = testClient;
    
    const res = await query({
        query: GET_SCHOOL_MEMBERSHIPS,
        variables: { user_id: userId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlMemberships = res.data?.user.school_memberships as SchoolMembership[];
    return gqlMemberships;
}

export async function getSchoolMembership(testClient: ApolloServerTestClient, userId: string, schoolId: string) {
    const { query } = testClient;

    const res = await query({
        query: GET_SCHOOL_MEMBERSHIP,
        variables: { user_id: userId, school_id: schoolId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlMembership = res.data?.user.school_membership as SchoolMembership;
    return gqlMembership;
}

export async function getClassesTeaching(testClient: ApolloServerTestClient, userId: string) {
    const { query } = testClient;
    
    const res = await query({
        query: GET_CLASSES_TEACHING,
        variables: { user_id: userId },
        headers: { authorization: JoeAuthToken },
    });
    
    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlClasses = res.data?.user.classesTeaching as Class[];
    return gqlClasses;
}

export async function getClassesStudying(testClient: ApolloServerTestClient, userId: string) {
    const { query } = testClient;
    
    const res = await query({
        query: GET_CLASSES_STUDYING,
        variables: { user_id: userId },
        headers: { authorization: JoeAuthToken },
    });
    
    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlClasses = res.data?.user.classesStudying as Class[];
    return gqlClasses;
}