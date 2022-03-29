import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_SCHEDULE_TIME_VIEW_LIST}?end_at_le=1640746740&org_id=${process.env.ORG_ID}&start_at_ge=1639450800&time_zone_offset=-10800&view_type=full_view` as string, params);

    console.log(JSON.stringify(res)),

    check(res, {
        'status is 200 meQueryReq4': () => res.status === 200,
    }, {
        userRoleType: roleType
    });
}
