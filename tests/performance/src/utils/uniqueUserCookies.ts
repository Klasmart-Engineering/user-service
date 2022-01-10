import loginSetup from './loginSetup';

const prefixLimit: number = !isNaN(parseInt(__ENV.PREFIX_LIMIT, 10)) ? parseInt(__ENV.PREFIX_LIMIT) : 9;

export default function() {
    let i = 0;
    const l = prefixLimit <= 9 ? prefixLimit : 9;
    let data = {};

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const teacherLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.TEACHER_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_TEACHER_1 as string,
        };
        const studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_STUDENT_1 as string,
        };
        const teacherLoginData = loginSetup(teacherLoginPayload);
        const studentLoginData = loginSetup(studentLoginPayload);
        data = { 
            ...data, 
            [`teacher${prefix}`]: teacherLoginData,
            [`students${prefix}`]: studentLoginData
        };
    }

    return data;
}