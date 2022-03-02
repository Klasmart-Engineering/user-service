import { check } from 'k6';
import http from 'k6/http';
import { meClassesStudying } from '../queries/users';
import { Counter, Trend } from 'k6/metrics';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('GetMeClassesStudying');
const serverWaitingTime = new Trend('GetMeClassesStudyingWaiting', true);

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        //operationName: 'me',
        query: meClassesStudying,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 meClassesStudying': () => res.status === 200,
        '"meClassesStudying" query returns data': (r) => JSON.parse(r.body as string).data?.me !== undefined,

    }, {
        userRoleType: roleType
    });

    if (res.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res.timings.waiting);
    }
}
