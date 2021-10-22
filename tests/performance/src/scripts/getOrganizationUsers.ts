import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { getPaginatedOrganizationUsers } from '../queries/users';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const userPayload = JSON.stringify({
        variables: {
            direction: 'FORWARD',
            count: 10,
            order: 'ASC',
            orderBy: 'givenName',
            filter: {
                organizationId: {
                    value: process.env.ORG_ID,
                    operator: 'eq',
                },
                AND: [{
                    OR: [
                        {
                            givenName: {
                                operator: 'contains',
                                value: '',
                                caseInsensitive: true,
                            }
                        },
                        {
                            familyName: {
                                operator: 'contains',
                                value: '',
                                caseInsensitive: true,
                            }
                        },
                        {
                            email: {
                                operator: 'contains',
                                value: '',
                                caseInsensitive: true,
                            }
                        },
                        {
                            phone: {
                                operator: 'contains',
                                value: '',
                                caseInsensitive: true,
                            }
                        },
                    ]
                }]
            }
        },
        operationName: 'getOrganizationUsers',
        query: getPaginatedOrganizationUsers,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    console.log(JSON.stringify(res));

    check(res, {
        '"Get paginated organization users" status is 200': () => res.status === 200,
        '"Get paginated organization users" query returns data': (r) => JSON.parse(r.body as string).data?.usersConnection ?? false,
    });
}
