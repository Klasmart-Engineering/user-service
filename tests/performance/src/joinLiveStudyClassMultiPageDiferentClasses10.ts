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
            duration: '10m',
        },
         students1: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students1',
            duration: '10m',
        },
        students2: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students2',
            duration: '10m',
        },
        students3: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students3',
            duration: '10m',
        },
        students4: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students4',
            duration: '10m',
        },
        // Class K6 010
        students5: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students5',
            duration: '10m',
        },
        // Class K6 011
        students6: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students6',
            duration: '10m',
        },
        // Class K6 012
        students7: {
        executor: 'constant-vus',
        vus: parseInt(__ENV.VUS, 10),
        exec: 'students7',
        duration: '10m',
        },
        // Class K6 013
        students8: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students8',
            duration: '10m',
        },
        // Class K6 014
        students9: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students9',
            duration: '10m',
        },
    },

    setupTimeout: '120m',
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
    "title":"Study #4 10 classes",
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

const studyClassPayload3 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP3,
}

const studyClassPayload4 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP4,
}

const studyClassPayload5 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP5,
}

const studyClassPayload6 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP6,
}

const studyClassPayload7 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP7,
}

const studyClassPayload8 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP8,
}

const studyClassPayload9 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP9,
}

const studyClassPayload10 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP10,
}

const studyClassPayload11 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP11,
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

    const classRosterData = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP7 as string);
    
    // agregar roster relacionado a los nuevos estudiantes
    const classRosterData3 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP3 as string);
    const classRosterData4 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP4 as string);
    const classRosterData5 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP5 as string);
    const classRosterData6 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP6 as string);
    const classRosterData7 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP7 as string);
    const classRosterData8 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP8 as string);
    const classRosterData9 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP9 as string);
    const classRosterData10 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP10 as string);
    const classRosterData11 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP11 as string);

    // create class
    const classPayload = {
        ...studyClassPayload,
        class_roster_student_ids: classRosterData.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData.class.teachers.map((teacher: any) => teacher.user_id),
    };

    // hacer lo mismo que la linea 95 pero para el otro payload
    const classPayload3 = {
        ...studyClassPayload3,
        class_roster_student_ids: classRosterData3.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData3.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload4 = {
        ...studyClassPayload4,
        class_roster_student_ids: classRosterData4.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData4.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload5 = {
        ...studyClassPayload5,
        class_roster_student_ids: classRosterData5.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData5.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload6 = {
        ...studyClassPayload6,
        class_roster_student_ids: classRosterData6.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData6.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload7 = {
        ...studyClassPayload7,
        class_roster_student_ids: classRosterData7.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData7.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload8 = {
        ...studyClassPayload8,
        class_roster_student_ids: classRosterData8.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData8.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload9 = {
        ...studyClassPayload9,
        class_roster_student_ids: classRosterData9.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData9.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload10 = {
        ...studyClassPayload10,
        class_roster_student_ids: classRosterData10.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData10.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload11 = {
        ...studyClassPayload11,
        class_roster_student_ids: classRosterData11.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData11.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const res = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload), params);
    
    // repeteri lo de la linea 103 para el otro payload
    const res3 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload3), params);
    const res4 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload4), params);
    const res5 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload5), params);
    const res6 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload6), params);
    const res7 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload7), params);
    const res8 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload8), params);
    const res9 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload9), params);
    const res10 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload10), params);
    const res11 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload11), params);

    // res
    if (!JSON.parse(res.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res.body as string).data?.id);
    }

    // res 3
    if (!JSON.parse(res3.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res3));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res3.body as string).data?.id);
    }

    // res 4
    if (!JSON.parse(res4.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res4));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res4.body as string).data?.id);
    }

    // res 5
      if (!JSON.parse(res5.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res5));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res5.body as string).data?.id);
    }

    // res 6
      if (!JSON.parse(res6.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res6));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res6.body as string).data?.id);
    }

     // res 7
     if (!JSON.parse(res7.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res7));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res7.body as string).data?.id);
    }

    // res 8
      if (!JSON.parse(res8.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res8));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res8.body as string).data?.id);
    }

    // res 9
    if (!JSON.parse(res9.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res9));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res9.body as string).data?.id);
    }

    // res 10
    if (!JSON.parse(res10.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res10));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res10.body as string).data?.id);
    }

    // res 11
    if (!JSON.parse(res11.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res11));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res11.body as string).data?.id);
    }

    data = {
        ...data,
        classId: JSON.parse(res.body as string).data?.id,
        //agrega el otro classId 2
        classId3: JSON.parse(res3.body as string).data?.id,
        classId4: JSON.parse(res4.body as string).data?.id,
        classId5: JSON.parse(res5.body as string).data?.id,
        classId6: JSON.parse(res6.body as string).data?.id,
        classId7: JSON.parse(res7.body as string).data?.id,
        classId8: JSON.parse(res8.body as string).data?.id,
        classId9: JSON.parse(res9.body as string).data?.id,
        classId10: JSON.parse(res10.body as string).data?.id,
        classId11: JSON.parse(res11.body as string).data?.id,
    }

    let i = 100; // cambie de 0 a 1
    let l = 300;

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
    
    //sleep(__VU * 0.1);

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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId3 as unknown as string);
    const liveclassPayload3 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId3 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveclassPayload3));

    studyClassWebSockets(liveclassPayload3);
}

export function students2(data: { [key: string]: { res: any, userId: string } }) {
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId4 as unknown as string);
    const liveclassPayload4 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId4 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveclassPayload4));

    studyClassWebSockets(liveclassPayload4);
}

export function students3(data: { [key: string]: { res: any, userId: string } }) {
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId5 as unknown as string);
    const liveclassPayload5 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId5 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveclassPayload5));

    studyClassWebSockets(liveclassPayload5);
}

export function students4(data: { [key: string]: { res: any, userId: string } }) {
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId6 as unknown as string);
    const liveclassPayload6 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId6 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveclassPayload6));

    studyClassWebSockets(liveclassPayload6);
} 

export function students5(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `2${('0' + randomNumber(20)).slice(-2)}`;
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId7 as unknown as string);

    const liveClassPayload7 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId7 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload7));

    studyClassWebSockets(liveClassPayload7);
}

export function students6(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `2${('0' + randomNumber(20)).slice(-2)}`;
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId8 as unknown as string);

    const liveClassPayload8 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId8 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload8));

    studyClassWebSockets(liveClassPayload8);
}

export function students7(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `2${('0' + randomNumber(20)).slice(-2)}`;
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId9 as unknown as string);

    const liveClassPayload9 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId9 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload9));

    studyClassWebSockets(liveClassPayload9);
}

export function students8(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `2${('0' + randomNumber(20)).slice(-2)}`;
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId10 as unknown as string);

    const liveClassPayload10 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId10 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload10));

    studyClassWebSockets(liveClassPayload10);
}

export function students9(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `2${('0' + randomNumber(20)).slice(-2)}`;
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
    
    //sleep(__VU * 0.1);

    const token = getLiveClassToken(data.classId11 as unknown as string);

    const liveClassPayload11 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId11 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload11));

    studyClassWebSockets(liveClassPayload11);
}