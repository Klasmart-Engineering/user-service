import { check } from 'k6';
import http from 'k6/http';
import { getOrganizationRoles } from '../queries/roles';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const Payload = JSON.stringify({
        variables: {
            organization_id: process.env.ORG_ID,
        },
        operationName: 'getOrganizationRoles',
        query: getOrganizationRoles,
    });

    const res = http.post(process.env.SERVICE_URL as string, Payload, params);

    check(res, {
                
    
        '"Test End Point User req 2" status is 200': () => res.status === 200,
        '"Test End Point User req 2" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,

    }, {
        userRoleType: roleType
    });
}