import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { SchoolsPayload } from '../interfaces/schoolts';
import { getSchoolsFilterList, meMembership, meMembership2, meMembership3 } from '../queries/schools';

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
    const membershipPayload1 = JSON.stringify({
        variables: {},
        query: meMembership,
    });

    // Payload for the query meMemership "2"
    const membershipPayload2 = JSON.stringify({
        variables: {},
        query: meMembership2,
    });

     // Payload for the query meMemership "3"
     const membershipPayload3 = JSON.stringify({
        variables: {},
        query: meMembership3,
    });



    // request to verfiy the memershipPayload 1
    const res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload1, params);
    
    // request to verfiy the memershipPayload 2
    const res2 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload2, params);

    // request to verfiy the memershipPayload 3
    const res3 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload3, params);

    console.log(JSON.stringify(res3));

    check(res, {
        '"Get me Memership 1" status is 200': () => res.status === 200,
        '"Get me Memership 1" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501 ?? true,
        '"Get me Memership 1.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501.schedule_search_582 ?? true,
        
        '"Get me Memership 2" status is 200': () => res2.status === 200,
        '"Get me Memership 2" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_student_187 ?? false,
        '"Get me Memership 2.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501.view_my_calendar_510 ?? true,
        '"Get me Memership 2.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501.create_schedule_page_501 ?? true,
        
        '"Get me Memership 3" status is 200': () => res3.status === 200,
        '"Get me Memership 3" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_teacher_186 ?? false,
        '"Get me Memership 3.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.ttend_live_class_as_a_teacher_186 ?? true,
        '"Get me Memership 3.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_event_520 ?? true,
        '"Get me Memership 3.D" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schedule_events_521 ?? false,
        '"Get me Memership 3.E" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schools_schedule_events_522 ?? false,

    }, {
        userRoleType: roleType
    });
}
