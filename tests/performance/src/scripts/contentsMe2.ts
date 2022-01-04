import { check } from 'k6';
import http from 'k6/http';
import { contentsMe2 } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        query: contentsMe2(process.env.ORG_ID as string),
    });

    const res = http.post(`${process.env.SERVICE_URL}/user/?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    check(res, {
        '"meMembership 2" status is 200': () => res.status === 200,
        '"meMembership 2" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership ?? false,
    }, {
        userRoleType: roleType
    });
}
