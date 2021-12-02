import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { meQuery } from '../queries/users';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify(
        {
        variables: {},
        query: meQuery,
    })


   const res = http.post(`${process.env.SCHEDULE_FILTER_PROGRAM_URL}?${process.env.ORG_ID}` as string, userPayload, params);

    check(res, {
        'SCHEDULE_FILTER_Program - status is 200': () => res.status === 200,
        //'schedule endpoint returns data': (r) => JSON.parse(r.body as string).data,
    }, {
        userRoleType: roleType
    });
}
