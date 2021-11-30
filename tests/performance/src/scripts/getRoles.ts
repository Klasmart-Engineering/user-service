import { check } from 'k6';
import http from 'k6/http';
import { getOrganizationRoles } from '../queries/roles';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (loginData?: { res: any, userId: string }) {
    if (loginData) {
        const jar = http.cookieJar();
        jar.set(process.env.SERVICE_URL as string, 'access', loginData.res.cookies?.access[0].Value);
        jar.set(process.env.SERVICE_URL as string, 'refresh', loginData.res.cookies?.refresh[0].Value);
    }

    const userPayload = JSON.stringify({
        variables: {
            organization_id: process.env.ORG_ID
        },
        operationName: 'getOrganizationRoles',
        query: getOrganizationRoles,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get roles" status is 200': () => res.status === 200,
        '"Get roles" query returns data': (r) => JSON.parse(r.body as string).data?.organization?.roles ?? false,
    });
}
