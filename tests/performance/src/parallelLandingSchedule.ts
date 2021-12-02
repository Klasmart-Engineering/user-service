import landingV2 from './scripts/landingV2';
import { Options } from 'k6/options';
import loginSetup from './utils/loginSetup';
import { sleep } from 'k6';
import landingSchedule from './scripts/landingSchedule';
import http from 'k6/http';

export function setup() {
    let i = 0;
    const l = 1;
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


export function teacher00(data: { [key: string]: { res: any, userId: string }}) {
    
    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.teacher00.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.teacher00.res.cookies?.refresh[0].Value);

    jar.set(process.env.LIVE_URL as string, 'access', data.teacher00.res.cookies?.access[0].Value);
    jar.set(process.env.LIVE_URL as string, 'refresh', data.teacher00.res.cookies?.refresh[0].Value);
    
    //landingV2(data.teacher00);
    sleep(5);
    landingSchedule(data.teacher00);

}
/* export function teacher01(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher01);
}
/*export function teacher02(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher02);
}
export function teacher03(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher03);
}
export function teacher04(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher04);
}
export function teacher05(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher05);
}
export function teacher06(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher06);
}
export function teacher07(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher07);
}
export function teacher08(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher08);
}
export function teacher09(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher09);
}
export function teacher10(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher10);
}
export function students00(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students00);
}
export function students01(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students01);
}
export function students02(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students02);
}
export function students03(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students03);
}
export function students04(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students04);
}
export function students05(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students05);
}
export function students06(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students06);
}
export function students07(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students07);
}
export function students08(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students08);
}
export function students09(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students09);
}
export function students10(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students10);
} */