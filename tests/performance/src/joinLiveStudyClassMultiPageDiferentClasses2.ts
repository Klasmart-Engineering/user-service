import http from 'k6/http';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import getLiveClassToken from './scripts/getLiveClassToken';
import { Options } from 'k6/options';
import { APIHeaders } from './utils/common';
import getClassRosterTest from './scripts/getClassRosterTest';
import studyClassWebSockets from './scripts/studyClassWebSockets';
import { sleep } from 'k6';
import randomNumber from './utils/randomNumber';

// Running 2 classes and 20 students per Study class
export const options: Options = {
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
    scenarios: {
        students: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students',
            duration: '30s',
        },
        students1: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students1',
            duration: '30s',
        },
    },
    setupTimeout: '10m',
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const studyClassPayload = {
    "attachment_path":"",
    "class_id": process.env.CLASS_ID_STUDY_SETUP2,
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
    "title":"test 4 classes",
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

const studyClassPayload2 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP3,
}

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

    const classRosterData = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP2 as string);
    
    // agregar roster relacionado a los nuevos estudiantes
    const classRosterData2 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP3 as string);

    // create class
    const classPayload = {
        ...studyClassPayload,
        class_roster_student_ids: classRosterData.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData.class.teachers.map((teacher: any) => teacher.user_id),
    };

    // hacer lo mismo que la linea 95 pero para el otro payload
    const classPayload2 = {
        ...studyClassPayload2,
        class_roster_student_ids: classRosterData2.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData2.class.teachers.map((teacher: any) => teacher.user_id),
    };


    const res = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload), params);
    
    // repeteri lo de la linea 103 para el otro payload
    const res2 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload2), params);


    if (!JSON.parse(res.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res.body as string).data?.id);
    }

    if (!JSON.parse(res2.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res2));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res2.body as string).data?.id);
    }
    
    data = {
        ...data,
        classId: JSON.parse(res.body as string).data?.id,
        //agrega el otro classId 2
        classId2: JSON.parse(res2.body as string).data?.id,
    }

    let i = 100; // cambie de 0 a 1
    let l = 141;

    for (i; i < l; i++) {
        const prefix = i; // reemplace el ('0' + i).slice(-2) por i
        const loginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
            pw: process.env.B2C_PASSWORD as string,
            // reemplace por el login del B2C
        };

        const studentLoginData = loginSetup(loginPayload);

        console.log(`Logged in student with ID: `, studentLoginData.userId);


        data = {
            ...data,
            [`student${prefix}`]: studentLoginData,
        }
    }

    return data;
}

export function students(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `1${('0' + randomNumber(20)).slice(-2)}`;
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data[`student${random}`].res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data[`student${random}`].res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    console.log(`Refresh ID for ${process.env.B2C_USERNAME}${random}${process.env.B2C_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 0.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload));

    studyClassWebSockets(liveClassPayload);
}

export function students1(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `1${('0' + randomNumber(20)).slice(-2)}`;
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data[`student${random}`].res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data[`student${random}`].res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    console.log(`Refresh ID for ${process.env.B2C_USERNAME}${random}@${process.env.B2C_DOMAIN}: ${refreshId}`);
    
    sleep(__VU * 0.5);

    const token = getLiveClassToken(data.classId2 as unknown as string);
    const liveClassPayload2 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId2 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload2));

    studyClassWebSockets(liveClassPayload2);
}