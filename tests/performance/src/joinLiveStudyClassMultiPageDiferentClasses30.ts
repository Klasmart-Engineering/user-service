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
        // Class K6 015
        students10: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students10',
            duration: '10m',
        },
        // Class K6 016
        students11: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students11',
            duration: '10m',
        },
        // Class K6 017
        students12: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students12',
            duration: '10m',
        },
        // Class K6 018
        students13: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students13',
            duration: '10m',
        },
        // Class K6 019
        students14: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students14',
            duration: '10m',
        },
        // Class K6 020
        students15: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students15',
            duration: '10m',
        },
        // Class K6 021
        students16: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students16',
            duration: '10m',
        },
        // Class K6 022
        students17: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students17',
            duration: '10m',
        },
        // Class K6 023
        students18: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students18',
            duration: '10m',
        },
        // Class K6 024
        students19: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students19',
            duration: '10m',
        },
        // Class K6 025
        students20: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students20',
            duration: '10m',
        },
        // Class K6 026
        students21: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students21',
            duration: '10m',
        },
        // Class K6 027
        students22: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students22',
            duration: '10m',
        },
        // Class K6 028
        students23: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students23',
            duration: '10m',
        },
        // Class K6 029
        students24: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students24',
            duration: '10m',
        },
        // Class K6 030
        students25: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students25',
            duration: '10m',
        },
        // Class K6 031
        students26: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students26',
            duration: '10m',
        },
        // Class K6 032
        students27: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students27',
            duration: '10m',
        },
        // Class K6 033
        students28: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students28',
            duration: '10m',
        },
        // Class K6 034
        students29: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students29',
            duration: '10m',
        }, 
        
    },

    setupTimeout: '180m',
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
    "title":"Study #4 30 Setup ALL",
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

// For Class K6 015
const studyClassPayload12 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP12,
}

// For Class K6 016
const studyClassPayload13 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP13,
}

// For Class K6 017
const studyClassPayload14 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP14,
}

// For Class K6 018
const studyClassPayload15 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP15,
}

// For Class K6 019
const studyClassPayload16 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP16,
}

// For Class K6 020
const studyClassPayload17 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP17,
}

// For Class K6 021
const studyClassPayload18 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP18,
}

// For Class K6 022
const studyClassPayload19 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP19,
}

// For Class K6 023
const studyClassPayload20 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP20,
}

// For Class K6 024
const studyClassPayload21 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP21,
}

// For Class K6 025
const studyClassPayload22 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP22,
}

// For Class K6 026
const studyClassPayload23 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP23,
}

// For Class K6 027
const studyClassPayload24 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP24,
}

// For Class K6 028
const studyClassPayload25 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP25,
}

// For Class K6 029
const studyClassPayload26 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP26,
}

// Desde aca ....
// For Class K6 030
const studyClassPayload27 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP27,
}

// For Class K6 031
const studyClassPayload28 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP28,
}

// For Class K6 032
const studyClassPayload29 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP29,
}

// For Class K6 033
const studyClassPayload30 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP30,
}

// For Class K6 034
const studyClassPayload31 = {
    ...studyClassPayload, "class_id": process.env.CLASS_ID_STUDY_SETUP31,
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
    const classRosterData3 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP3 as string);
    const classRosterData4 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP4 as string);
    const classRosterData5 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP5 as string);
    const classRosterData6 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP6 as string);
    const classRosterData7 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP7 as string);
    const classRosterData8 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP8 as string);
    const classRosterData9 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP9 as string);
    const classRosterData10 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP10 as string);
    const classRosterData11 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP11 as string);
    const classRosterData12 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP12 as string);
    const classRosterData13 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP13 as string);
    const classRosterData14 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP14 as string);
    const classRosterData15 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP15 as string);
    const classRosterData16 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP16 as string);
    const classRosterData17 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP17 as string);
    const classRosterData18 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP18 as string);
    const classRosterData19 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP19 as string);
    const classRosterData20 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP20 as string);
    const classRosterData21 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP21 as string);
    const classRosterData22 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP22 as string);
    const classRosterData23 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP23 as string);
    const classRosterData24 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP24 as string);
    const classRosterData25 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP25 as string);
    const classRosterData26 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP26 as string);
    const classRosterData27 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP27 as string);
    const classRosterData28 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP28 as string);
    const classRosterData29 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP29 as string);
    const classRosterData30 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP30 as string);
    const classRosterData31 = getClassRosterTest(process.env.ORG_ID as string, process.env.CLASS_ID_STUDY_SETUP31 as string);
    
    

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

    const classPayload12 = {
        ...studyClassPayload12,
        class_roster_student_ids: classRosterData12.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData12.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload13 = {
        ...studyClassPayload13,
        class_roster_student_ids: classRosterData13.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData13.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload14 = {
        ...studyClassPayload14,
        class_roster_student_ids: classRosterData14.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData14.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload15 = {
        ...studyClassPayload15,
        class_roster_student_ids: classRosterData15.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData15.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload16 = {
        ...studyClassPayload16,
        class_roster_student_ids: classRosterData16.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData16.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload17 = {
        ...studyClassPayload17,
        class_roster_student_ids: classRosterData17.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData17.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload18 = {
        ...studyClassPayload18,
        class_roster_student_ids: classRosterData18.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData18.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload19 = {
        ...studyClassPayload19,
        class_roster_student_ids: classRosterData19.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData19.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload20 = {
        ...studyClassPayload20,
        class_roster_student_ids: classRosterData20.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData20.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload21 = {
        ...studyClassPayload21,
        class_roster_student_ids: classRosterData21.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData21.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload22 = {
        ...studyClassPayload22,
        class_roster_student_ids: classRosterData22.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData22.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload23 = {
        ...studyClassPayload23,
        class_roster_student_ids: classRosterData23.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData23.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload24 = {
        ...studyClassPayload24,
        class_roster_student_ids: classRosterData24.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData24.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload25 = {
        ...studyClassPayload25,
        class_roster_student_ids: classRosterData25.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData25.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload26 = {
        ...studyClassPayload26,
        class_roster_student_ids: classRosterData26.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData26.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload27 = {
        ...studyClassPayload27,
        class_roster_student_ids: classRosterData27.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData27.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload28 = {
        ...studyClassPayload28,
        class_roster_student_ids: classRosterData28.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData28.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload29 = {
        ...studyClassPayload29,
        class_roster_student_ids: classRosterData29.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData29.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload30 = {
        ...studyClassPayload30,
        class_roster_student_ids: classRosterData30.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData30.class.teachers.map((teacher: any) => teacher.user_id),
    };

    const classPayload31 = {
        ...studyClassPayload31,
        class_roster_student_ids: classRosterData31.class.students.map((student: any) => student.user_id),
        class_roster_teacher_ids: classRosterData31.class.teachers.map((teacher: any) => teacher.user_id),
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
    const res12 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload12), params);
    const res13 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload13), params);
    const res14 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload14), params);
    const res15 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload15), params);
    const res16 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload16), params);
    const res17 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload17), params);
    const res18 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload18), params);
    const res19 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload19), params);
    const res20 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload20), params);
    const res21 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload21), params);
    const res22 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload22), params);
    const res23 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload23), params);
    const res24 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload24), params);
    const res25 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload25), params);
    const res26 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload26), params);
    const res27 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload27), params);
    const res28 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload28), params);
    const res29 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload29), params);
    const res30 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload30), params);
    const res31 = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, JSON.stringify(classPayload31), params);

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

    // res 12
    if (!JSON.parse(res12.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res12));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res12.body as string).data?.id);
    }

    // res 13
    if (!JSON.parse(res13.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res13));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res13.body as string).data?.id);
    }

    // res 14
    if (!JSON.parse(res14.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res14));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res14.body as string).data?.id);
    }

    // res 15
    if (!JSON.parse(res15.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res15));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res15.body as string).data?.id);
    }

    // res 16
    if (!JSON.parse(res16.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res16));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res16.body as string).data?.id);
    }

    // res 17
    if (!JSON.parse(res17.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res17));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res17.body as string).data?.id);
    }

    // res 18
    if (!JSON.parse(res18.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res18));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res18.body as string).data?.id);
    }

    // res 19
    if (!JSON.parse(res19.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res19));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res19.body as string).data?.id);
    }

    // res 20
    if (!JSON.parse(res20.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res20));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res20.body as string).data?.id);
    }

    // res 21
    if (!JSON.parse(res21.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res21));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res21.body as string).data?.id);
    }

    // res 22
    if (!JSON.parse(res22.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res22));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res22.body as string).data?.id);
    }

    // res 23
    if (!JSON.parse(res23.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res23));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res23.body as string).data?.id);
    }

    // res 24
    if (!JSON.parse(res24.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res24));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res24.body as string).data?.id);
    }

    // res 25
    if (!JSON.parse(res25.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res25));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res25.body as string).data?.id);
    }

    // res 26
    if (!JSON.parse(res26.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res26));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res26.body as string).data?.id);
    }

     // res 27
     if (!JSON.parse(res27.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res27));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res27.body as string).data?.id);
    }

         // res 28
    if (!JSON.parse(res28.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res28));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res28.body as string).data?.id);
    }

         // res 29
    if (!JSON.parse(res29.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res29));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res29.body as string).data?.id);
    }

         // res 30
    if (!JSON.parse(res30.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res30));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res30.body as string).data?.id);
    }

         // res 26
    if (!JSON.parse(res31.body as string).data?.id) {
        throw new Error('Class ID not setup, aborting test!' + JSON.stringify(res31));
    } else {
        console.log('Class created successfully with ID: ', JSON.parse(res31.body as string).data?.id);
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
        classId12: JSON.parse(res12.body as string).data?.id,
        classId13: JSON.parse(res13.body as string).data?.id,
        classId14: JSON.parse(res14.body as string).data?.id,
        classId15: JSON.parse(res15.body as string).data?.id,
        classId16: JSON.parse(res16.body as string).data?.id,
        classId17: JSON.parse(res17.body as string).data?.id,
        classId18: JSON.parse(res18.body as string).data?.id,
        classId19: JSON.parse(res19.body as string).data?.id,
        classId20: JSON.parse(res20.body as string).data?.id,
        classId21: JSON.parse(res21.body as string).data?.id,
        classId22: JSON.parse(res22.body as string).data?.id,
        classId23: JSON.parse(res23.body as string).data?.id,
        classId24: JSON.parse(res24.body as string).data?.id,
        classId25: JSON.parse(res25.body as string).data?.id,
        classId26: JSON.parse(res26.body as string).data?.id,
        classId27: JSON.parse(res22.body as string).data?.id,
        classId28: JSON.parse(res28.body as string).data?.id,
        classId29: JSON.parse(res29.body as string).data?.id,
        classId30: JSON.parse(res30.body as string).data?.id,
        classId31: JSON.parse(res31.body as string).data?.id,
    }

    let i = 100; // cambie de 0 a 1
    let l = 700;

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

// Hasta el Stundent4 son los primeros 100, random = 1

//Class K6 005
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

//Class K6 006
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

//Class K6 007
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

//Class K6 008
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

//Class K6 009
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

// Hasta el Stundent14 son los primeros 200 al 299, random = 2
//Class K6 010
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

//Class K6 011
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

//Class K6 012
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

//Class K6 013
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

//Class K6 014
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

// Hasta el Stundent14 son los primeros 300 al 399, random = 3
// Class K6 015 
export function students10(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `3${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId12 as unknown as string);

    const liveClassPayload12 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId12 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload12));

    studyClassWebSockets(liveClassPayload12);
}

// Class K6 016
export function students11(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `3${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId13 as unknown as string);

    const liveClassPayload13 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId13 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload13));

    studyClassWebSockets(liveClassPayload13);
}

// Class K6 017 students12
export function students12(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `3${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId14 as unknown as string);

    const liveClassPayload14 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId14 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload14));

    studyClassWebSockets(liveClassPayload14);
}

// Class K6 018 students13
export function students13(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `3${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId15 as unknown as string);

    const liveClassPayload15 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId15 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload15));

    studyClassWebSockets(liveClassPayload15);
}

// Class K6 019 students14
export function students14(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `3${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId16 as unknown as string);

    const liveClassPayload16 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId16 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload16));

    studyClassWebSockets(liveClassPayload16);
}

// Hasta el Stundent19 son los primeros 400 al 499, random = 4
// Class K6 020 students15
export function students15(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `4${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId17 as unknown as string);

    const liveClassPayload17 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId17 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload17));

    studyClassWebSockets(liveClassPayload17);
}

// Class K6 021 students16
export function students16(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `4${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId18 as unknown as string);

    const liveClassPayload18 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId18 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload18));

    studyClassWebSockets(liveClassPayload18);
}

// Class K6 022 students17
export function students17(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `4${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId19 as unknown as string);

    const liveClassPayload19 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId19 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload19));

    studyClassWebSockets(liveClassPayload19);
}

// Class K6 023 students18
export function students18(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(20);
    const random = `4${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId20 as unknown as string);

    const liveClassPayload20 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId20 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload20));

    studyClassWebSockets(liveClassPayload20);
}

// Class K6 024 students19
export function students19(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(21);
    const random = `4${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId21 as unknown as string);

    const liveClassPayload21 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId21 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload21));

    studyClassWebSockets(liveClassPayload21);
}

// Hasta el Stundent24 son los primeros 500 al 599, random = 5
// Class K6 025 students20
export function students20(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `5${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId22 as unknown as string);

    const liveClassPayload22 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId22 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload22));

    studyClassWebSockets(liveClassPayload22);
}

// Class K6 026 students21
export function students21(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `5${('0' + randomNumber(20)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId23 as unknown as string);

    const liveClassPayload23 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId23 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload23));

    studyClassWebSockets(liveClassPayload23);
}

// Class K6 027 students22
export function students22(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `5${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId24 as unknown as string);

    const liveClassPayload24 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId24 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload24));

    studyClassWebSockets(liveClassPayload24);
}

 // Class K6 028 students23
export function students23(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `5${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId25 as unknown as string);

    const liveClassPayload25 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId25 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload25));

    studyClassWebSockets(liveClassPayload25);
}
 
// Class K6 029 students24
export function students24(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `5${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId26 as unknown as string);

    const liveClassPayload26 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId26 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload26));

    studyClassWebSockets(liveClassPayload26);
}

// Hasta el Stundent29 son los primeros 600 al 699, random = 6
// Class K6 030 students25
export function students25(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `6${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId27 as unknown as string);

    const liveClassPayload27 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId27 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload27));

    studyClassWebSockets(liveClassPayload27);
}

// Class K6 031 students26
export function students26(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `6${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId28 as unknown as string);

    const liveClassPayload28 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId28 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload28));

    studyClassWebSockets(liveClassPayload28);
}

//Class K6 032 students27
export function students27(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `6${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId29 as unknown as string);

    const liveClassPayload29 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId29 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload29));

    studyClassWebSockets(liveClassPayload29);
}

//Class K6 033 students28
export function students28(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `6${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId30 as unknown as string);

    const liveClassPayload30 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId30 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload30));

    studyClassWebSockets(liveClassPayload30);
}

//Class K6 034 students29
export function students29(data: { [key: string]: { res: any, userId: string } }) {
    //const random = randomNumber(22);
    const random = `6${('0' + randomNumber(22)).slice(-2)}`;
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

    const token = getLiveClassToken(data.classId31 as unknown as string);

    const liveClassPayload31 = {
        token,
        refreshId: refreshId as unknown as string,
        roomId: data.classId31 as unknown as string,
        accessCookie: data[`student${random}`].res.cookies?.access[0].Value,
        userId: data[`student${random}`].userId,
    };

    console.log(JSON.stringify(liveClassPayload31));

    studyClassWebSockets(liveClassPayload31);
}