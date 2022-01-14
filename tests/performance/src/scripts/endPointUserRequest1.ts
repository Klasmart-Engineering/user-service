import { check } from 'k6';
import http from 'k6/http';
import { getPaginatedOrganizationSchools } from '../queries/schools';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) { 
    const payload = JSON.stringify({
        variables: {"direction": "FORWARD",
        "count": 50,
        "order": "ASC",
        "orderBy": "name",
        "cursor": "",
        "filter": {
        "organizationId": {
            "value": "360b46fe-3579-42d4-9a39-dc48726d033f",
            "operator": "eq"
        },
        "status": {
            "operator": "eq",
            "value": "active"
        },
        "AND": [
            {
            "OR": [
                {
                "name": {
                    "operator": "contains",
                    "caseInsensitive": true,
                    "value": ""
                },
                "shortCode": {
                    "operator": "contains",
                    "caseInsensitive": true,
                    "value": ""
                }
                }
            ]
            }
        ]},
        },
        operationName: 'getOrganizationSchools',
        query: getPaginatedOrganizationSchools,
    });

    const res = http.post(process.env.SERVICE_URL as string, payload, params);

    check(res, {
        '"Test End Point User req 1" status is 200': () => res.status === 200,
        '"Test End Point User req 1" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,
    }, {
        userRoleType: roleType
    });
}