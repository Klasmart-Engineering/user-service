import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('ScheduleFilterProgram');
const serverWaitingTime = new Trend('ScheduleFilterProgramWaiting', true);

export default function (roleType?: string) {
    const res = http.get(`${process.env.SCHEDULE_FILTER_PROGRAM_URL}?org_id=${process.env.ORG_ID}` as string, params)
    
    check(res, {
        'SCHEDULE_FILTER_Program - status is 200': () => res.status === 200,
    }, {
        userRoleType: roleType
    });

    if (res.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res.timings.waiting);
    }
}
