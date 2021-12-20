import generateClassPayload from "../utils/generateClassPayload";
import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const res = http.get(`${process.env.SCHEDULES_URL}?
        teacher_name=edgardo&page=1
        &page_size=10&time_zone_offset=-21600&start_at=${new Date().getTime() / 1000}
        &order_by=schedule_at
        &org_id=${process.env.ORG_ID}`, params);

    console.log(JSON.stringify(res));

    check(res, {
        'CREATE LIVE CLASS status is 200': () => res.status === 200,
        'CREATE LIVE CLASS returned class ID': (r) => JSON.parse(r.body as string).data?.id ?? false,
    });
}
