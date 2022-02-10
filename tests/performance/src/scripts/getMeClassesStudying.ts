import { check } from 'k6';
import http from 'k6/http';
import { meClassesStudying } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        //operationName: 'me',
        query: meClassesStudying,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    console.log(JSON.stringify(res));

    check(res, {
        'status is 200 meClassesStudying': () => res.status === 200,
        '"meClassesStudying" query returns data': (r) => JSON.parse(r.body as string).data?.me !== undefined,

    }, {
        userRoleType: roleType
    });
}
