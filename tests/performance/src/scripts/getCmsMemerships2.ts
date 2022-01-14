import { check } from 'k6';
import http from 'k6/http';
import {meMembershipForCMS2 } from '../queries/cms';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {

    const userPayload = JSON.stringify({
        variables: {},
        
        query: meMembershipForCMS2,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get meMembershipForCMS 2" status is 200': () => res.status === 200,
        '"Get meMembershipForCMS 2" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,
    });

}
