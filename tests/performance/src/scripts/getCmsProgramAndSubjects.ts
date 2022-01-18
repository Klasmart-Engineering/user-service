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
    const userPayload = JSON.stringify({
        variables: {
            count: 10,
            cursor: '',
           },
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
                ],
                    status: {
                        value: 'active',
                        operator: 'eq',
                    }
            }]    
        },
        operationName: 'getProgramsAndSubjects',
        query: getProgramsAndSubjects,
    });

    const res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, userPayload, params);

    console.log(JSON.stringify(res))

    check(res, {
        '"POST Program And Subjects" status is 200': () => res.status === 200,
        '"POST Program And Subjects" query returns data': (r) => JSON.parse(r.body as string).data !== undefined,
    });

}
