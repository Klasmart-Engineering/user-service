import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { meMembershipForStudent1, meMembershipForStudent2, meMembershipForStudent3, meMembershipForStudent4, meMembershipForStudent5, meMembershipForTeacher1, meMembershipForTeacher2, meMembershipForTeacher3,  meMembershipForTeacher4, meMembershipForTeacher5  } from '../queries/schools';
import { meQueryReq1 } from '../queries/users';
/* export const options:Options = {
    vus: 1,
};
 */
const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    
    // Payload for the query meMemership "1"
    const membershipPayload1 = JSON.stringify({
        variables: {},
        query: meMembershipForStudent1,
    });

    // Payload for the query meMemership "2"
    const membershipPayload2 = JSON.stringify({
        variables: {},
        query: meMembershipForStudent2,
    });

     // Payload for the query meMemership "3"
     const membershipPayload3 = JSON.stringify({
        variables: {},
        query: meMembershipForStudent3,
    });

     // Payload for the query meMemership "4"
     const membershipPayload4 = JSON.stringify({
        variables: {},
        query: meMembershipForStudent4,
    });

      // Payload for the query meMemership "5"
      const meQueryBasic = JSON.stringify({
        variables: {},
        query: meQueryReq1,
    });

    // Payload for the query meMemership "5"
    const membershipPayload5 = JSON.stringify({
        variables: {},
        query: meMembershipForStudent5,
    });


    // request to verfiy the memershipPayload 1
    const res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload1, params);
   
    // request to verfiy the memershipPayload 2
    const res2 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload2, params);

    // request to verfiy the memershipPayload 3
    const res3 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload3, params);
    
    // request to verfiy the memershipPayload 3
    const res4 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload4, params);

    const resBascic = http.post(process.env.SERVICE_URL as string, meQueryBasic, params);

    // request to verfiy the memershipPayload 3
    const res5 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload5, params);
 

    check(res, {
        '"Get me membership 1" status is 200': (r) => r.status === 200,
        '"Get me membership 1" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501 ?? false, // expected: true
        '"Get me membership 1.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.schedule_search_582 ?? false, // expected: false
      
   }, {
        userRoleType: roleType
    });

    check(res2, {

        '"Get me membership 2" status is 200': (r) => r.status === 200,
        '"Get me membership 2" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_teacher_186 ?? false, // expected: true
        '"Get me membership 2.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_event_520 ?? false, //false
        '"Get me membership 2.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schedule_events_521 ?? false, // expected: true
        '"Get me membership 2.D" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schools_schedule_events_522 ?? false, //false
        '"Get me membership 2.E" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_student_187 ?? false, //false
    
   }, {
        userRoleType: roleType
    });

    check(res3, {
         
        '"Get me membership 3" status is 200': (r) => r.status === 200,
        '"Get me membership 3" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_live_calendar_events_524 ?? false, // expected: true
        '"Get me membership 3.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_class_calendar_events_525 ?? false, // expected: true
        '"Get me membership 3.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_study_calendar_events_526 ?? false, // expected: true
        '"Get me membership 3.D" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_home_fun_calendar_events_527 ?? false, // expected: true
     
   }, {
        userRoleType: roleType
    });

    check(res4, {
        
        '"Get me membership 4" status is 200': (r) => r.status === 200,
        '"Get me membership 4" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_student_187 ?? false, // expected: false
        '"Get me membership 4.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.view_my_calendar_510 ?? false, // expected: true
        '"Get me membership 4.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501 ?? false, // expected: true
     
   }, {
        userRoleType: roleType
    });

    check(resBascic, {
        'status is 200 meQueryReq1': () => res.status === 200,
        '"meQueryReq1" query returns data': (r) => JSON.parse(r.body as string).data?.me ?? false,

    }, {
        userRoleType: roleType
    });

    check(res5, {
         
        '"Get me membership 5" status is 200': (r) => r.status === 200,
        '"Get me membership 5" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_event_520 ?? false, // expected: false
        '"Get me membership 5.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schools_schedule_events_522 ?? false, // expected: false
        '"Get me membership 5.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schedule_events_521 ?? false, // expected: true
        '"Get me membership 5.D" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_student_187 ?? false, // expected: false
        '"Get me membership 5.E" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.view_subjects_20115 ?? false, // expected: true
     
   }, {
        userRoleType: roleType
    });

}
