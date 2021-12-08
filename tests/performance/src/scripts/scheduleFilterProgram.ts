import { check } from 'k6';
import http from 'k6/http';
import { meQuery } from '../queries/users';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        query: meQuery,
    })


    const res = http.get(`${process.env.SCHEDULE_FILTER_PROGRAM_URL}?org_id=${process.env.ORG_ID}` as string, params);

    
    
    check(res, {
        'SCHEDULE_FILTER_Program - status is 200': () => res.status === 200,
        'schedule filter endpoint returns data': (r) => JSON.parse(r.body as string).data,
    }, {
        userRoleType: roleType
    });
}
