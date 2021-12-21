import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import {getUserQuery, meQueryReq1 } from '../queries/users';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.ASSESSMENT_SUMMARY_URL}?org_id=${process.env.ORG_ID}` as string, params);

    check(res, {
        'status is 200 meQueryReq3': () => res.status === 200,
    }, {
        userRoleType: roleType
    });
}
