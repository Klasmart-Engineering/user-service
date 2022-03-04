import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('MeQueryOrganizationReq3');
const serverWaitingTime = new Trend('meQueryOrganizationReq3Waiting', true);

const errorCounter = new Counter('MeQueryOrganizationReq3Error');

export default function (roleType?: string) {
    const res = http.get(`${process.env.ASSESSMENT_SUMMARY_URL}?org_id=${process.env.ORG_ID}` as string, params);

    check(res, {
        'status is 200 meQueryReq3': () => res.status === 200,
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
