import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const path = `teacher_name=teacher&page=1&page_size=10&time_zone_offset=-21600&start_at=${Math.round(new Date().getTime() / 1000)}&order_by=schedule_at&org_id=${process.env.ORG_ID}`;
    const res = http.get(`${process.env.SCHEDULES_URL}?${path.replace(`\n`, '')}`, params);

    check(res, {
        'SCHEDULE SEARCH status is 200': () => res.status === 200,
        'SCHEDULE SEARCHreturned valid data': (r) => JSON.parse(r.body as string).total ?  JSON.parse(r.body as string).total >= 1 : false,
    });
}
