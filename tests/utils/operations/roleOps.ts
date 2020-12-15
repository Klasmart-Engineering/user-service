import { ApolloServerTestClient } from "../createTestClient";
import { Headers } from 'node-mocks-http';
import { gqlTry } from "../gqlTry";
import { Role } from "../../../src/entities/role";
import { Permission } from "../../../src/entities/permission";

const UPDATE_ROLE = `
    mutation myMutation(
            $role_id: ID!,
            $role_name: String) {
        role(role_id: $role_id) {
            set(role_name: $role_name) {
                role_id
                role_name
            }
        }
    }
`;

const GET_PERMISSION = `
    query myMutation(
            $role_id: ID!,
            $permission_name: String!) {
        role(role_id: $role_id) {
            permission(permission_name: $permission_name) {
                role_id
                permission_name
                allow
            }
        }
    }
`;

const GRANT_PERMISSION = `
    mutation myMutation(
            $role_id: ID!
            $permission_name: String!) {
        role(role_id: $role_id) {
            grant(permission_name: $permission_name) {
                role_id
                permission_name
                allow
            }
        }
    }
`;

const REVOKE_PERMISSION = `
    mutation myMutation(
            $role_id: ID!
            $permission_name: String!) {
        role(role_id: $role_id) {
            revoke(permission_name: $permission_name)
        }
    }
`;

const DENY_PERMISSION = `
    mutation myMutation(
            $role_id: ID!
            $permission_name: String!) {
        role(role_id: $role_id) {
            deny(permission_name: $permission_name) {
                role_id
                permission_name
                allow
            }
        }
    }
`;

const DELETE_ROLE = `
    mutation myMutation(
            $role_id: ID!) {
        role(role_id: $role_id) {
            delete_role()
        }
    }
`;

export async function updateRole(testClient: ApolloServerTestClient, roleId: string, roleName: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: UPDATE_ROLE,
        variables: { role_id: roleId, role_name: roleName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlRole = res.data?.role.set as Role;
    return gqlRole;
}

export async function getPermissionViaRole(testClient: ApolloServerTestClient, roleId: string, permissionName: string, headers?: Headers) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_PERMISSION,
        variables: { role_id: roleId, permission_name: permissionName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlPermission = res.data?.role.permission as Permission;
    return gqlPermission;
}

export async function grantPermission(testClient: ApolloServerTestClient, roleId: string, permissionName: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: GRANT_PERMISSION,
        variables: { role_id: roleId, permission_name: permissionName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlPermission = res.data?.role.grant as Permission;
    return gqlPermission;
}

export async function revokePermission(testClient: ApolloServerTestClient, roleId: string, permissionName: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: REVOKE_PERMISSION,
        variables: { role_id: roleId, permission_name: permissionName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    return res.data?.role.revoke as boolean;
}

export async function denyPermission(testClient: ApolloServerTestClient, roleId: string, permissionName: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DENY_PERMISSION,
        variables: { role_id: roleId, permission_name: permissionName },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlPermission = res.data?.role.deny as Permission;
    return gqlPermission;
}

export async function deleteRole(testClient: ApolloServerTestClient, roleId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_ROLE,
        variables: { role_id: roleId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    return res.data?.delete_role as boolean;
}