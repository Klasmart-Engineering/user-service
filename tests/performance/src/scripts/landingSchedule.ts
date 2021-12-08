import { sleep } from "k6";
import schedulesTimeView from "./schedulesTimeView";
import scheduleFilterProgram from "./scheduleFilterProgram";
import scheduleFilterClass from "./scheduleFilterClass";
import getSchoolsFilter from "./getSchoolsFilter";

export default function(skipTimeView?: boolean) {
    if (!skipTimeView) {
        schedulesTimeView();
    }

    sleep(5);
    
    if (!skipTimeView) {
        scheduleFilterProgram();
    }
    sleep(5);
    scheduleFilterClass();
    sleep(0.5);
    getSchoolsFilter();
}
