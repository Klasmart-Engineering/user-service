import { check } from 'k6';
import http from 'k6/http';
import { meQueryOrganizationReq5 } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        query: meQueryOrganizationReq5,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    console.log(JSON.stringify(res))

    check(res, {
        'status is 200 meQueryOrganizationReq5': () => res.status === 200,
        '"meQueryOrganizationReq5" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,

    }, {
        userRoleType: roleType
    });
}
