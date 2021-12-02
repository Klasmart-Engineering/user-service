import { sleep } from "k6";
import http from "k6/http";
import getUserTest from "./getUserTest";
import schedulesTimeView from "./schedulesTimeView";
import scheduleFilter from "./scheduleFilterProgram";
import loginSetup from "../utils/loginSetup";
import scheduleFilterProgram from "./scheduleFilterProgram";
import scheduleFilterClass from "./scheduleFilterClass";

export default function(data: { res: any, userId: string}) {
    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.res.cookies?.refresh[0].Value);

    jar.set(process.env.LIVE_URL as string, 'access', data.res.cookies?.access[0].Value);
    jar.set(process.env.LIVE_URL as string, 'refresh', data.res.cookies?.refresh[0].Value);

    schedulesTimeView();

    sleep(5);
    scheduleFilterProgram();
    sleep(5);
    scheduleFilterClass();
    sleep(0.5);
}
