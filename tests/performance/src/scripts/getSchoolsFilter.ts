import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { SchoolsPayload } from '../interfaces/schoolts';
import { getSchoolsFilterList } from '../queries/schools';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    

    const userPayload = JSON.stringify({
        variables: {
            direction: 'FORWARD',
            directionArgs:{
                count: 5,
            },
            filter: {
                status: {
                    value: 'active',
                    operator: 'eq',
                },
            }
        },
        operationName: 'getSchoolsFilterList',
        query: getSchoolsFilterList,
    });

    const res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    //console.log(JSON.stringify(res));

    check(res, {
        '"Get school filter list" status is 200': () => res.status === 200,
        '"Get school filter list" query returns data': (r) => JSON.parse(r.body as string).data?.schoolsConnection?.edges ?? false,
    }, {
        userRoleType: roleType
    });
}
