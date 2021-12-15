import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import {meQueryReq1 } from '../queries/users';


export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        query: meQueryReq1,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 meQueryReq1': () => res.status === 200,
        '"meQueryReq1" query returns data': (r) => JSON.parse(r.body as string).data?.me ?? false,

    }, {
        userRoleType: roleType
    });
}
