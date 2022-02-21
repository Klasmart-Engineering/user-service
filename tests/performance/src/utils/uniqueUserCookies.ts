import loginSetup from './loginSetup';

const prefixLimit: number = !isNaN(parseInt(__ENV.PREFIX_LIMIT, 10)) ? parseInt(__ENV.PREFIX_LIMIT) : 9;

export default function() {
    let i = 1;
    const l = 10;
    let data = {};

    for (i; i <= 10; i++) {
        const prefix = ('0' + i).slice(-2);
        const teacherLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.TEACHER_USERNAME}${i}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW as string,
        };
        const studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.STUDENT_USERNAME}${i}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW as string,
        };
        // console.log(JSON.stringify(studentLoginPayload));
        // const teacherLoginData = loginSetup(teacherLoginPayload);
        const studentLoginData = loginSetup(studentLoginPayload);
        data = { 
            ...data, 
            // [`teacher${prefix}`]: teacherLoginData,
            [`student${prefix}`]: studentLoginData
        };
    }

    return data;
}