import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { getClassFilterList } from '../queries/classes';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('GetClassFilter');
const serverWaitingTime = new Trend('GetClassFilterWaiting', true);

const errorCounter = new Counter('GetClassFilterError');

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        variables: {
            direction: 'FORWARD',
            directionArgs:{
                count: 5,
            },
            filter: {
                organizationId: {
                    operator: 'eq',
                    value:'360b46fe-3579-42d4-9a39-dc48726d033f', //should be dinamic
                },
                schoolId: {
                    operator: 'isNull',
                },
                status: {
                    value: 'active',
                    operator: 'eq',
                },
            }
        },
        operationName: 'getClassFilterList',
        query: getClassFilterList,
    });

    let res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    if (res.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);
    }
    
    check(res, {
        '"Get CLASS filter list" status is 200': () => res.status === 200,
        // '"Get CLASS filter list" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,
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

