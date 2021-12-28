import { check } from 'k6';
import http from 'k6/http';
import { getOrganizationRolesPermissions } from '../queries/roles';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {

    const userPayload = JSON.stringify({
        variables: {
           organization_id: process.env.ORG_ID,
        },
        operationName: 'getOrganizationRoles',
        query: getOrganizationRolesPermissions,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get organization roles" status is 200': () => res.status === 200,
        '"Get organization roles" query returns data': (r) => JSON.parse(r.body as string).data?.organization ?? false,
    });

    const data = JSON.parse(res.body as string).data;
    return data?.usersConnection?.pageInfo;
}
