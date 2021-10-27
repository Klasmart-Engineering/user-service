import landing from './scripts/landing';
import { Options } from 'k6/options';
import loginSetup from './utils/loginSetup';

export const options: Options = {
    scenarios: {
        teacher: {
            executor: 'ramping-vus',
            exec: 'teacher',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 20
                },
                // Hold
                {
                    duration: '2m',
                    target: 40
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 5
                },
            ],
        },
        student: {
            executor: 'ramping-vus',
            exec: 'student',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up          
                {
                    duration: '20s',
                    target: 50
                },
                // Hold
                {
                    duration: '2m',
                    target: 400
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 10
                },
            ],
        },
    },
}

export function setup() {
    const teacherLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_TEACHER_1 as string,
        pw: process.env.PW_TEACHER_1 as string,
    };

    const teacherData = loginSetup(teacherLoginPayload);

    const studentLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_STUDENT_1 as string,
        pw: process.env.PW_STUDENT_1 as string,
    };

   const studentData = loginSetup(studentLoginPayload);
   return { studentData, teacherData };
}

export function teacher(data: { studentData: { res: any, userId: string }, teacherData: { res: any, userId: string }}) {
    landing(data.teacherData);
}

export function student(data: { studentData: { res: any, userId: string }, teacherData: { res: any, userId: string }}) {
    landing(data.studentData);
}
