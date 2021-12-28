import { check } from 'k6';
import http from 'k6/http';
import { get_organization_memberships } from '../queries/organizations';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        query: get_organization_memberships,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 meQueryOrganizationReq2': () => res.status === 200,
        '"meQueryOrganizationReq2" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,

    }, {
        userRoleType: roleType
    });
}
