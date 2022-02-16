import { check } from 'k6';
import http from 'k6/http';
import { getClassFilterList } from '../queries/classes';


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
                    organizationId: {
                        operator: 'eq',
                        value:'360b46fe-3579-42d4-9a39-dc48726d033f', //should be dinamic
                    },
                    schoolId: {
                        operator: 'isNull',
                    },
                    status: {
                        value: 'active',
                        operator: 'eq',
                    },
                }
            },
            operationName: 'getClassFilterList',
            query: getClassFilterList,
        });
    
        const res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

        check(res, {
            '"Get CLASS filter list" status is 200': () => res.status === 200,
           // '"Get CLASS filter list" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,
        }, {
            userRoleType: roleType
        });
}

