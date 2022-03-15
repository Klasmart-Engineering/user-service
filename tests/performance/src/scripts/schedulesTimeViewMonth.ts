import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { Options } from 'k6/options';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('SchedulesTimeView');
const serverWaitingTime = new Trend('SchedulesTimeViewWaiting', true);

const errorCounter = new Counter('CmsSSchedulesTimeViewError');

export default function (roleType?: string) {
    const userPayload = JSON.stringify(
        {
            "view_type": "month",
            "time_at": Math.round(new Date().getTime() / 1000),
            "time_zone_offset": -10800,
            "class_types": [],
            "class_ids": [],
            "subject_ids": [],
            "program_ids": [],
            "user_id": []
        }
    );

    let res = http.post(`${process.env.CMS_SCHEDULE_TIME_VIEW_LIST}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    if (res.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res = http.post(`${process.env.CMS_SCHEDULE_TIME_VIEW_LIST}?org_id=${process.env.ORG_ID}` as string, userPayload, params);
    }
    
    check(res, {
        'SCHEDULES_TIME_VIEW - status is 200': () => res.status === 200,
        //'schedule time view endpoint returns data': (r) => JSON.parse(r.body as string).data,
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
