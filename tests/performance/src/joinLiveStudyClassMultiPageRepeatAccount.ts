import { Options } from 'k6/options';
import http from 'k6/http';


import landingV3Students from './scripts/landingV3Students';


import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import getLiveClassToken from './scripts/getLiveClassToken';

import { APIHeaders } from './utils/common';
import getClassRosterTest from './scripts/getClassRosterTest';
import studyClassWebSockets from './scripts/studyClassWebSockets';
import { sleep } from 'k6';
import randomNumber from './utils/randomNumber';


export const options: Options = {
    
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },

    scenarios:{
        students00: {
            executor: 'constant-vus',
            exec: 'students00',
            vus: 100,
            duration: '10m',
          },
 
           students01: {
            executor: 'constant-vus',
            exec: 'students01',
            vus: 100,
            duration: '10m',
          },
 
          students02: {
            executor: 'constant-vus',
            exec: 'students02',
            vus: 100,
            duration: '10m',
          },

          students03: {
            executor: 'constant-vus',
            exec: 'students03',
            vus: 100,
            duration: '10m',
          },

          students04: {
            executor: 'constant-vus',
            exec: 'students04',
            vus: 100,
            duration: '10m',
          },
          students05: {
            executor: 'constant-vus',
            exec: 'students05',
            vus: 100,
            duration: '10m',
          },
          students06: {
            executor: 'constant-vus',
            exec: 'students06',
            vus: 100,
            duration: '10m',
          },
          students07: {
            executor: 'constant-vus',
            exec: 'students07',
            vus: 100,
            duration: '10m',
          },
          students08: {
            executor: 'constant-vus',
            exec: 'students08',
            vus: 100,
            duration: '10m',
          },
          students09: {
            executor: 'constant-vus',
            exec: 'students09',
            vus: 100,
            duration: '10m',
          },
   },
    setupTimeout: '5m',
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const studyClassPayload = {
    "attachment_path":"",
    "class_id": process.env.CLASS_ID_STUDY_SETUP,
    "class_type": "Homework",
    "description":"",
    "due_at": Math.round((new Date().getTime() + (7 * 60000)) / 1000),
    "is_all_day":false,
    "is_force":true,
    "is_repeat":false,
    "lesson_plan_id": process.env.LESSON_PLAN_ID,
    "program_id": process.env.PROGRAM_ID,
    "repeat":{},
    "subject_id": process.env.SUBJECT_ID,
    "teacher_ids": [],
    "title":"test Repeated",
    "outcome_ids":[],
    "start_at": Math.round((new Date().getTime() + (7 * 60000)) / 1000),
    "end_at": Math.round((new Date().getTime() + (7 * 60000)) / 1000),
    "subject_ids":[process.env.SUBJECT_ID],
    "attachment":{"id":"","name":""},
    "time_zone_offset":-21600,
    "is_home_fun":false,
    "class_roster_student_ids": [],
    "class_roster_teacher_ids": [], 
    "participants_student_ids":[],
    "participants_teacher_ids":[]
};

export function setup() {
    let data: { [key: string]: { res: any, userId: string }} = {};
    const orgAdminLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW as string,
    };
    
    const orgAdminLoginData = loginSetup(orgAdminLoginPayload);
    console.log('Org admin logged in, creating class...');
    data = { 
        ...data, 
        [`orgAdmin`]: orgAdminLoginData,
    };

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    const classRosterData = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP as string);

    // create class
    const classPayload = {
        ...studyClassPayload,
        class_roster_student_ids: classRosterData.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const res = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload), params);
    
    if (!JSON.parse(res.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res.body as string).data?.id);
    }
    
    data = {
        ...data,
        classId: JSON.parse(res.body as string).data?.id,
    }

    let i = 0;
    let l = 10;

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const loginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW as string,
        };

        const studentLoginData = loginSetup(loginPayload);

        console.log(`Logged in student with ID: `, studentLoginData.userId);


        data = {
            ...data,
            [`students${prefix}`]: studentLoginData,
        }
    }

    return data;
}


export function students00(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students00.res.cookies?.access[0].Value,
        userId: data.students00.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}


export function students01(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students01.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students01.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students01.res.cookies?.access[0].Value,
        userId: data.students01.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students02(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students02.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students02.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students02.res.cookies?.access[0].Value,
        userId: data.students02.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students03(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students03.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students03.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students03.res.cookies?.access[0].Value,
        userId: data.students03.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students04(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students04.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students04.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students04.res.cookies?.access[0].Value,
        userId: data.students04.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students05(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students05.res.cookies?.access[0].Value,
        userId: data.students05.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students06(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students06.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students06.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students06.res.cookies?.access[0].Value,
        userId: data.students06.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students07(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students07.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students07.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students07.res.cookies?.access[0].Value,
        userId: data.students07.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students08(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students08.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students08.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students08.res.cookies?.access[0].Value,
        userId: data.students08.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students09(data: { [key: string]: { res: any, userId: string } }) {
    const random = randomNumber(9);
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students09.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students09.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    //console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}0${random}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students09.res.cookies?.access[0].Value,
        userId: data.students09.userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}