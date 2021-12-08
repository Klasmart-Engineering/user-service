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
    const userPayload = JSON.stringify(
        {
        variables: {},
        //query: meQuery,
    })


   const res = http.get(`${process.env.SCHEDULE_FILTER_CLASS_URL}?school_id=-1&org_id=${process.env.ORG_ID}` as string);

   // console.log(JSON.stringify(res));

    check(res, {
        'SCHEDULE_FILTER_Class - status is 200': () => res.status === 200,
        //'schedule endpoint returns data': (r) => JSON.parse(r.body as string).data,
    }, {
        userRoleType: roleType
    });
}
