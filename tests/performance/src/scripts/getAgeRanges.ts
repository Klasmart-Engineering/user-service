import { check } from 'k6';
import http from 'k6/http';
import { SchoolsPayload } from '../interfaces/schoolts';
import { getAgeRanges } from '../queries/ageRanges';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (payload?: SchoolsPayload) {
    const userPayload = JSON.stringify({
        variables: {
            direction: 'FORWARD',
            count: payload?.count || 10,
            order: 'ASC',
            orderBy: ['lowValueUnit', 'lowValue'],
            filter: {
                AND: [{
                    OR: [
                        {
                            organizationId: {
                                value: process.env.ORG_ID,
                                operator: 'eq',
                            },
                        },
                        {
                            system: {
                                value: true,
                                operator: 'eq',
                            }
                        },
                    ]
                }]
            }
        },
        operationName: 'getPaginatedAgeRanges',
        query: getAgeRanges,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get paginated age ranges" status is 200': () => res.status === 200,
        '"Get paginated age ranges" query returns data': (r) => JSON.parse(r.body as string).data?.ageRangesConnection?.edges ?? false,
    });
}
