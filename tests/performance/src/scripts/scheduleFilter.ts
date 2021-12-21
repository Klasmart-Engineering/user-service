import { check } from 'k6';
import http from 'k6/http';
import { liveClass } from '../utils/generateScheduleFilters';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const payload = JSON.stringify(liveClass);
    const res = http.post(`${process.env.CMS_SCHEDULE_TIME_VIEW}list?org_id=${process.env.ORG_ID}`, payload, params);

    check(res, {
        'SCHEDULE FILTERS status is 200': () => res.status === 200,
        'SCHEDULE FILTERS returned valid data': (r) => JSON.parse(r.body as string).total ?  JSON.parse(r.body as string).total >= 1 : false,
    });
}
