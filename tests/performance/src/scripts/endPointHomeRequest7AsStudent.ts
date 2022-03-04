import { check } from 'k6';
import http from 'k6/http';
import { getUserNode } from '../queries/users';
import { Counter, Trend } from 'k6/metrics';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

/* const userPayload = JSON.stringify({
    operationName: "getUserNode",
    variables: {},
    query: getUserNode
}); */

const counter = new Counter('endPointHomeRequest7AsStudent');
const serverWaitingTime = new Trend('endPointHomeRequest7AsStudentWaiting', true);

const errorCounter = new Counter('endPointHomeRequest7AsStudentError');

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        operationName: "getUserNode",
        variables: {
            id: process.env.ID_STUDENT_00,
            organizationId: process.env.ORG_ID
        },
        query: getUserNode
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 meQueryReq7 STUDENT': () => res.status === 200,
        //'"meQueryReq7 STUDENT" query returns data': (r) => JSON.parse(r.body as string).data?.me !== undefined,

    }, {
        userRoleType: roleType
    });

   /*  if (res.status === 200) {
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