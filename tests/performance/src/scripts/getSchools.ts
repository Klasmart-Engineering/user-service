import { check } from 'k6';
import http from 'k6/http';
import { SchoolsPayload } from '../interfaces/schoolts';
import { getPaginatedOrganizationSchools } from '../queries/schools';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (payload: SchoolsPayload, loginData?: { res: any, userId: string }) {
    if (loginData) {
        const jar = http.cookieJar();
        jar.set(process.env.SERVICE_URL as string, 'access', loginData.res.cookies?.access[0].Value);
        jar.set(process.env.SERVICE_URL as string, 'refresh', loginData.res.cookies?.refresh[0].Value);
    }

    const userPayload = JSON.stringify({
        variables: {
            direction: 'FORWARD',
            count: payload.count,
            order: 'ASC',
            orderBy: payload.orderBy || 'name',
            filter: {
                organizationId: {
                    value: process.env.ORG_ID,
                    operator: 'eq',
                },
                AND: [{
                    OR: [
                        {
                            name: {
                                operator: 'contains',
                                value: payload.name || '',
                                caseInsensitive: true,
                            }
                        },
                        {
                            shortCode: {
                                operator: 'contains',
                                value: payload.shortCode || '',
                                caseInsensitive: true,
                            }
                        },
                    ]
                }]
            }
        },
        operationName: 'getOrganizationSchools',
        query: getPaginatedOrganizationSchools,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get paginated organization schools" status is 200': () => res.status === 200,
        '"Get paginated organization schools" query returns data': (r) => JSON.parse(r.body as string).data?.schoolsConnection?.edges ?? false,
    });
}
