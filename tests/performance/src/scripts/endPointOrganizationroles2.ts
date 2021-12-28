import { check } from 'k6';
import http from 'k6/http';
import { get_organization_roles } from '../queries/organizations';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {
            organizationId: process.env.ORG_ID
        },
        query: get_organization_roles,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    console.log(JSON.stringify(res)),

    check(res, {
        'status is 200 meQueryOrganizationReq2': () => res.status === 200,
        '"meQueryOrganizationReq2" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,

    }, {
        userRoleType: roleType
    });
}
