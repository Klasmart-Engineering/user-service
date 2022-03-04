import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { Options } from 'k6/options';
import { getSchoolsFilterList } from '../queries/schools';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('GetSchoolsFilter');
const serverWaitingTime = new Trend('GetSchoolsFilterWaiting', true);

const errorCounter = new Counter('GetSchoolsFilterError');

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {
            direction: 'FORWARD',
            directionArgs:{
                count: 5,
            },
            filter: {
                status: {
                    value: 'active',
                    operator: 'eq',
                },
            }
        },
        operationName: 'getSchoolsFilterList',
        query: getSchoolsFilterList,
    });

    const res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    check(res, {
        '"Get SCHOOL filter list" status is 200': () => res.status === 200,
       // '"Get school filter list" query returns data': (r) => JSON.parse(r.body as string).data?.schoolsConnection?.edges ?? false,
    }, {
        userRoleType: roleType
    });

    if (res.status >= 200 && res.status <= 299) {
        counter.add(1);
        
    } else {
        errorCounter.add(1);
    }
    serverWaitingTime.add(res.timings.waiting);
   
}
