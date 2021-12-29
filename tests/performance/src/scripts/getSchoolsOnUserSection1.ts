import { check } from 'k6';
import http from 'k6/http';
//import { getSchoolsFilterList } from '../queries/schools'
import { getSchoolsOnsUser1 } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const Payload = JSON.stringify({
        variables: {
            direction: 'FORWARD',
            count: 50,
            order: 'ASC',
            orderBy: 'name',
            cursor: '',
            filter: {
                organizationId: {
                    value: process.env.ORG_ID,
                    operator: 'eq',
                },
                status:{
                    operator: 'eq',
                    value: 'active',
                },
                AND: [{
                    OR: [
                        {
                            name: {
                                operator: 'contains',
                                caseInsensitive: true,
                                value: '',
                            },
                            shortcode: {
                                operator: 'contains',
                                caseInsensitive: true,
                                value: '',
                            }
                        },
                    ]
                }]
            }
        },
        operationName: 'getOrganizationSchools',
        query: getSchoolsOnsUser1,
    });

    const res = http.post(process.env.SERVICE_URL as string, Payload, params);

    console.log(JSON.stringify(res)),

    check(res, {
                
    
        '"Get paginated organization schools" status is 200': () => res.status === 200,
        '"Get paginated organization schools" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,

    }, {
        userRoleType: roleType
    });
}