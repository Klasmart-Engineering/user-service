import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { getMyUsers } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('getMyUsers');
const serverWaitingTime = new Trend('getMyUsersWaiting', true);

const errorCounter400 = new Counter('getMyUsersError400');
const errorCounter500 = new Counter('getMyUsersError500');

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {},
        query: getMyUsers
    });

    let res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    if (res.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res = http.post(process.env.SERVICE_URL as string, userPayload, params);
    }

    check(res, {
        'status is 200 myUser plural': () => res.status === 200,
        '"myUsers plural" query returns data': (r) => JSON.parse(r.body as string).data?.my_users !== undefined,

    }, {
        userRoleType: roleType
    });

    /* if (res.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res.timings.waiting);
    } */

    if (res.status >= 200 && res.status <= 299) {
        counter.add(1);
        
    } else if (res.status >= 400 && res.status <= 499) {
        errorCounter400.add(1);
    } else {
        errorCounter500.add(1);
    }

    serverWaitingTime.add(res.timings.waiting);
}
