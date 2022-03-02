import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { getMyUser } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('getMyUser');
const serverWaitingTime = new Trend('getMyUserWaiting', true);

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        //operationName: 'myUser',
        query: getMyUser
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 myUser singular': () => res.status === 200,
       // '"myUser singular" query returns data': (r) => JSON.parse(r.body as string).data?.my_user !== undefined,

    }, {
        userRoleType: roleType
    });

    if (res.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res.timings.waiting);
    }
}
