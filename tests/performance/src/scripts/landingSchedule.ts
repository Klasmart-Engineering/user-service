import { sleep } from "k6";
import http from "k6/http";
import getUserTest from "./getUserTest";
import schedulesTimeView from "./schedulesTimeView";
import scheduleFilter from "./scheduleFilterProgram";
import loginSetup from "../utils/loginSetup";
import scheduleFilterProgram from "./scheduleFilterProgram";
import scheduleFilterClass from "./scheduleFilterClass";

export default function() {
    schedulesTimeView();

    sleep(5);
    scheduleFilterProgram();
    sleep(5);
    scheduleFilterClass();
    sleep(0.5);
}
