import { check } from 'k6';
import http from 'k6/http';
import { getMyUsers } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        query: getMyUsers
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 myUser plural': () => res.status === 200,
        '"myUsers plural" query returns data': (r) => JSON.parse(r.body as string).data?.my_users !== undefined,

    }, {
        userRoleType: roleType
    });
}
