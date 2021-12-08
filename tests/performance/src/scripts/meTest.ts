import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { meQuery } from '../queries/users';


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
        query: meQuery,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        ' meTest - status is 200': () => res.status === 200,
        '"me" query returns data': (r) => JSON.parse(r.body as string).data?.me ?? false,
    }, {
        userRoleType: roleType
    });
}
