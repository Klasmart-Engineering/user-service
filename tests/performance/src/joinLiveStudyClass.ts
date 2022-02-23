import http from 'k6/http';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import getLiveClassToken from './scripts/getLiveClassToken';
import liveClassWebSockets from './scripts/liveClassWebSockets';
import previewLiveStudy from './scripts/previewLiveStudyClass';
import { Options } from 'k6/options';
import { APIHeaders } from './utils/common';
import getClassRosterTest from './scripts/getClassRosterTest';
import { sleep } from 'k6';

export const options: Options = {
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
    scenarios: {
        students: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students',
        },
    }
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
    class_roster_student_ids: ["496fb421-0a80-48d6-9cc2-588044d7b095"],
    class_roster_teacher_ids: [process.env.STUDY_TEACHER_ID_1, process.env.STUDY_TEACHER_ID_2, process.env.ID_ORG_ADMIN_1],
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
    participants_teacher_ids: [],
    program_id: process.env.PROGRAM_ID,
    repeat: {},
    start_at: Math.round((new Date().getTime() + (5 * 60000)) / 1000),
    subject_id: process.env.SUBJECT_ID,
    subject_ids: [process.env.SUBJECT_ID],
    teacher_ids: [process.env.STUDY_TEACHER_ID_1],
    time_zone_offset: -21600,
    title: "Study Class",
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

    return data;
}

export function students(data: { [key: string]: { res: any, userId: string } }) {
    const prefix = ('0' + (__VU - 1)).slice(-2);
    const loginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
        pw: process.env.PW as string,
    };
    const studentLoginData = loginSetup(loginPayload);
    console.log(`Logged in student: ${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`);

    const refresh = http.get(`${process.env.AUTH_URL}refresh`, {
        headers: APIHeaders,
    });
    
    const refreshId = JSON.parse(refresh.body as string)?.id;

    console.log(`Refresh ID for ${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}: ${refreshId}`);
    
    const accessCookie = studentLoginData.res.cookies?.access[0].value;
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', accessCookie, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', studentLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    sleep(__VU * 1.5);

    const token = getLiveClassToken(data.classId as unknown as string);
    console.log(`Token for ${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}: ${token}`);
    previewLiveStudy(data.classId as unknown as string);
    const liveClassPayload = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId as unknown as string,
        accessCookie: accessCookie,
        userId: studentLoginData.userId,
    };

    liveClassWebSockets(liveClassPayload);
}
