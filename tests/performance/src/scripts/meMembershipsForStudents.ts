import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
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

const counter = new Counter('MeMembershipStudents');
const serverWaitingTime = new Trend('MeMembershipStudentsWaiting', true);

const errorCounter = new Counter('MeMembershipStudentsError');

const counterBasic = new Counter('MeQueryBasicInStudents');
const serverWaitingTimeBasic = new Trend('MeQueryBasicInStudentsWaiting', true);

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
    let res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload1, params);
   
    if (res.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload1, params);
    }
    
    /* if (res.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res.timings.waiting);
    } */

    if (res.status >= 200 && res.status <= 299) {
        counter.add(1);
        
    } else {
        errorCounter.add(1);
    }
    serverWaitingTime.add(res.timings.waiting);

    // request to verfiy the memershipPayload 2
    let res2 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload2, params);

    if (res2.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res2 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload2, params);
    }
   
    /* if (res2.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res2.timings.waiting);
    } */

    if (res2.status >= 200 && res2.status <= 299) {
        counter.add(1);
        
    } else {
        errorCounter.add(1);
    }
    serverWaitingTime.add(res2.timings.waiting);

    // request to verfiy the memershipPayload 3
    let res3 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload3, params);
    
    if (res3.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res3 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload3, params);
    }
    /* if (res3.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res3.timings.waiting);
    } */

    if (res3.status >= 200 && res3.status <= 299) {
        counter.add(1);
        
    } else {
        errorCounter.add(1);
    }
    serverWaitingTime.add(res3.timings.waiting);

    // request to verfiy the memershipPayload 4
    let res4 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload4, params);


    if (res4.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res4 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload4, params);
    }
    /* if (res4.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res4.timings.waiting);
    } */    

    let resBasic = http.post(process.env.SERVICE_URL as string, meQueryBasic, params);

    if (resBasic.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        resBasic = http.post(process.env.SERVICE_URL as string, meQueryBasic, params);
    }

    /* if (resBasic.status === 200) {
        counter.add(1);
        serverWaitingTime.add(resBasic.timings.waiting);
    } */

    if (resBasic.status >= 200 && resBasic.status <= 299) {
        counter.add(1);
        
    } else {
        errorCounter.add(1);
    }
    serverWaitingTime.add(resBasic.timings.waiting);


    // request to verfiy the memershipPayload 5
    let res5 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload5, params);
 
    if (res5.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res5 = http.post(`${process.env.SERVICE_URL}?org_id=${process.env.ORG_ID}` as string, membershipPayload5, params);
    }
    /* if (res5.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res5.timings.waiting);
    } */

    if (res4.status >= 200 && res4.status <= 299) {
        counter.add(1);
        
    } else {
        errorCounter.add(1);
    }
    serverWaitingTime.add(res4.timings.waiting);

    check(res, {
        '"Get me membership 1" status is 200': (r) => r.status === 200,
       /*'"Get me membership 1" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501 ?? false, // expected: true
        '"Get me membership 1.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.schedule_search_582 ?? false, // expected: false
       */
   }, {
        userRoleType: roleType
    });

    check(res2, {

        '"Get me membership 2" status is 200': (r) => r.status === 200,
        /* '"Get me membership 2" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_teacher_186 ?? false, // expected: true
        '"Get me membership 2.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_event_520 ?? false, //false
        '"Get me membership 2.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schedule_events_521 ?? false, // expected: true
        '"Get me membership 2.D" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schools_schedule_events_522 ?? false, //false
        '"Get me membership 2.E" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_student_187 ?? false, //false
     */
   }, {
        userRoleType: roleType
    });

    check(res3, {
         
        '"Get me membership 3" status is 200': (r) => r.status === 200,
       /*  '"Get me membership 3" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_live_calendar_events_524 ?? false, // expected: true
        '"Get me membership 3.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_class_calendar_events_525 ?? false, // expected: true
        '"Get me membership 3.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_study_calendar_events_526 ?? false, // expected: true
        '"Get me membership 3.D" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_home_fun_calendar_events_527 ?? false, // expected: true
   */   
   }, {
        userRoleType: roleType
    });

    check(res4, {
        
        '"Get me membership 4" status is 200': (r) => r.status === 200,
        /* '"Get me membership 4" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_student_187 ?? false, // expected: false
        '"Get me membership 4.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.view_my_calendar_510 ?? false, // expected: true
        '"Get me membership 4.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_schedule_page_501 ?? false, // expected: true
      */
   }, {
        userRoleType: roleType
    });

    check(resBasic, {
        'status is 200 meQueryReq1': () => res.status === 200,
      //  '"meQueryReq1" query returns data': (r) => JSON.parse(r.body as string).data?.me ?? false,

    }, {
        userRoleType: roleType
    });

    check(res5, {
         
        '"Get me membership 5" status is 200': (r) => r.status === 200,
        /* '"Get me membership 5" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_event_520 ?? false, // expected: false
        '"Get me membership 5.B" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schools_schedule_events_522 ?? false, // expected: false
        '"Get me membership 5.C" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.create_my_schedule_events_521 ?? false, // expected: true
        '"Get me membership 5.D" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.attend_live_class_as_a_student_187 ?? false, // expected: false
        '"Get me membership 5.E" query returns data': (r) => JSON.parse(r.body as string).data?.meMembership?.membership.view_subjects_20115 ?? false, // expected: true
      */
   }, {
        userRoleType: roleType
    });

}
