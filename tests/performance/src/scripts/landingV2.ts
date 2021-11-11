import { sleep } from "k6";
import http from "k6/http";
import getUserTest from "./getUserTest";
import meTest from "./meTest";
import loginSetup from "../utils/loginSetup";

export function setup() {
    const loginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_TEACHER_1 as string,
        pw: process.env.PW_TEACHER_1 as string,
    };

    return loginSetup(loginPayload)
}   

export default function(data: { res: any, userId: string }) {
    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.res.cookies?.refresh[0].Value);

    meTest();
    sleep(1);
    meTest();
    sleep(1);
    meTest();
    sleep(0.5)
    getUserTest(data.userId);
    sleep(1);
    meTest();
    sleep(0.5)
    getUserTest(data.userId);
    sleep(0.5)
    meTest();
}
