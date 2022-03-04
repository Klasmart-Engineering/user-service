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

const counter = new Counter('CmsScheduleTimeViewList');
const serverWaitingTime = new Trend('CmsScheduleTimeViewListWaiting', true);

const errorCounter = new Counter('CmsScheduleTimeViewListError');

export default function (roleType?: string) {
    const userPayload = JSON.stringify(
        {
            view_type: "full_view",
            page: 1,
            page_size: 20,
            time_at: 0,
            start_at_ge: 1644548400,
            end_at_le: 1645844340,
            time_zone_offset: -10800,
            order_by: "start_at",
            time_boundary: "union"
        }
    );

    const res = http.post(`${process.env.CMS_SCHEDULE_TIME_VIEW_LIST}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    check(res, {
        'SCHEDULES_time_view FULL VIEW - status is 200': () => res.status === 200,
        //'schedule time view FULL VIEW returns data': (r) => JSON.parse(r.body as string).data,
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
