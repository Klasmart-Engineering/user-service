import http from 'k6/http';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import getLiveClassToken from './scripts/getLiveClassToken';
import liveClassWebSockets from './scripts/liveClassWebSockets';
import previewLiveStudy from './scripts/previewLiveStudyClass';
import { Options } from 'k6/options';
import { APIHeaders } from './utils/common';

/* export const options: Options = {
    vus: 1,
    iterations: 1,
}; */

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
            vus: 1,
            duration: '1m',
          },

        /*   students01: {
            executor: 'constant-vus',
            exec: 'students01',
            vus: 1,
            duration: '1m',
          }, */
    }, 
};


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const studyClassPayload = {
    attachment: {id: "", name: ""},
    attachment_path: "",
    class_id: process.env.CLASS_ID_STUDY_SETUP,
    class_roster_student_ids: [process.env.STUDY_STUDENT_ID_1, process.env.STUDY_STUDENT_ID_2, process.env.CLASS_STUDENT_ID_1],
    class_roster_teacher_ids: [process.env.STUDENT_TEACHER_ID_1, process.env.STUDEY_TEACHER_ID_2, process.env.ID_ORG_ADMIN_1],
    class_type: "Homework",
    description: "",
    due_at: Math.round((new Date().getTime() + (7 * 60000)) / 1000),
    end_at: Math.round((new Date().getTime() + (7 * 60000)) / 1000),
    is_all_day: false,
    is_force: true,
    is_home_fun: false,
    is_repeat: false,
    lesson_plan_id: process.env.LESSON_PLAN_ID,
    outcome_ids: [],
    participants_student_ids: [],
    participants_teacher_ids: [process.env.STUDY_PARTICIPANT_TEACHER_ID_1],
    program_id: process.env.PROGRAM_ID,
    repeat: {},
    start_at: Math.round((new Date().getTime() + (5 * 60000)) / 1000),
    subject_id: process.env.SUBJECT_ID,
    subject_ids: [process.env.SUBJECT_ID],
    teacher_ids: [process.env.STUDY_TEACHER_ID_1],
    time_zone_offset: -21600,
    title: "Study Class Pino",
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

    // create class
    const res = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(studyClassPayload), params);

    data = {
        ...data,
        classId: JSON.parse(res.body as string).data?.id,
    }

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });

    data = {
        ...data,
        refreshId: JSON.parse(refresh.body as string)?.id,
    }

    const studentLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: 'edgardom+students07@bluetrailsoft.com', // `${process.env.STUDENT_USERNAME}07@${process.env.EMAIL_DOMAIN}`,
        pw: 'Test123?' as string,
    };

    const studentLoginData = loginSetup(studentLoginPayload);
    data = { 
        ...data,
        [`students07`]: studentLoginData
    };

    // Intento de loguear multiples usuarios
    let i = 0;
    const l = 2;
    let data2 = {};

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW as string,
        };
        
        const studentLoginData = loginSetup(studentLoginPayload);
        data2 = { 
            ...data2, 
            [`students${prefix}`]: studentLoginData,
        };

        return data2;
    }

    // hasta el bloque de estudiantes. Solo los primeros 2 estudiantes 00/01

    return data;
    return data2;
}

export function students07(data: { [key: string]: { res: any, userId: string } }) {
    if (!data.classId) {
        throw new Error('Class ID not setup' + JSON.stringify(data));
    }

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students07.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students07.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    const token = getLiveClassToken(data.classId as unknown as string)
    previewLiveStudy(data.classId as unknown as string);
    liveClassWebSockets({
        token,
        refreshId: data.refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data.students07.res.cookies?.access[0].Value,
    });
}

// login el estuaniante 00

export function students00(data: { [key: string]: { res: any, userId: string } }, data2: { [key: string]: { res: any, userId: string }}) {
   
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data2.students00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data2.students00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    const token = getLiveClassToken(data.classId as unknown as string)
    previewLiveStudy(data.classId as unknown as string);
    liveClassWebSockets({
        token,
        refreshId: data.refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: data2.students00.res.cookies?.access[0].Value,
    });
}
