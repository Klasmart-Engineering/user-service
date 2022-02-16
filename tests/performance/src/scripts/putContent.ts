import { check } from 'k6';
import http from 'k6/http';
import { UserPayload } from '../interfaces/users';
import { getPaginatedOrganizationUsers } from '../queries/users';
import { Filter } from '../interfaces/filters';
import { getProgramsAndSubjects } from '../queries/cms';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};



export default function (){

    const payload = JSON.stringify({
        variables: {
            scope: "360b46fe-3579-42d4-9a39-dc48726d033f"
            
        },

    });
    
    const res = http.put(`${process.env.CMS_PLAN_CONTENTS_URL}/61e5ba1d149efab04a01288d/publish?org_id=${process.env.ORG_ID}` as string, payload, params);

    check(res, {
        '"PUT Content" status is 200': () => res.status === 200,
        '"PUT Content" query returns data': (r) => JSON.parse(r.body as string).id !== undefined,
    });

}
