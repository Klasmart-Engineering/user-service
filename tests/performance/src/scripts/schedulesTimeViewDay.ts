import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify(
        {
            "view_type": "day",
            "time_at": Math.round(new Date().getTime() / 1000),
            "time_zone_offset": -10800,
            "class_types": [],
            "class_ids": [],
            "subject_ids": [],
            "program_ids": [],
            "user_id": []
        }
    );

    const res = http.post(`${process.env.SCHEDULES_TIME_VIEW_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    check(res, {
        'SCHEDULES_TIME_VIEW_DAY - status is 200': () => res.status === 200,
        'schedule time view DAY endpoint returns data': (r) => JSON.parse(r.body as string).data,
    }, {
        userRoleType: roleType
    });
}
