import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { meMembership } from '../queries/schools';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    
    // Payload for the query meMemership "1"
    const membershipPayload = JSON.stringify({
        variables: {},
        query: meMembership,
    });

    // request to verfiy the memershipPayload 1
    const res = http.post(`${process.env.SERVICE_URL}/user/?org_id=${process.env.ORG_ID}` as string, membershipPayload, params);
    
    check(res, {
        '"Get me membership 1 - SchedueleReq5" status is 200': () => res.status === 200,
        '"Get me membership 1 - SchedueleReq5" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,
        
    }, {
        userRoleType: roleType
    });
}
