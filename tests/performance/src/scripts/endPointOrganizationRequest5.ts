import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { meQueryOrganizationReq5 } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('MeQueryOrganizationReq5');
const serverWaitingTime = new Trend('meQueryOrganizationReq5Waiting', true);

const errorCounter = new Counter('MeQueryOrganizationReq5Error');

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        //operationName: "me",
        query: meQueryOrganizationReq5,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 meQueryOrganizationReq5': () => res.status === 200,
        '"meQueryOrganizationReq5" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,

    }, {
        userRoleType: roleType
    });

    /* if (res.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res.timings.waiting);
    } */

    if (res.status >= 200 && res.status <= 299) {
        counter.add(1);
        
    } else {
        errorCounter.add(1);
    }
    serverWaitingTime.add(res.timings.waiting);

}
