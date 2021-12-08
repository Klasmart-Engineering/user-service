import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { meQuery } from '../queries/users';


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
            "view_type": "month",
            "time_at": 1637707512,
            "time_zone_offset": -10800,
            "class_types": [],
            "class_ids": [],
            "subject_ids": [],
            "program_ids": []
        }
    );

    const res = http.post(`${process.env.SCHEDULES_TIME_VIEW_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

   // console.log(JSON.stringify(res));

    check(res, {
        'SCHEDULES_TIME_VIEW - status is 200': () => res.status === 200,
       // 'schedule endpoint returns data': (r) => JSON.parse(r.body as string).id.name?? false,
    }, {
        userRoleType: roleType
    });
}
