import { sleep } from "k6";
import schedulesTimeView from "./schedulesTimeViewMonth";
import scheduleFilterProgram from "./scheduleFilterProgram";
import meMembershipsForTeacher from "./meMembershipsForTeacher";
import getSchoolsFilter from "./getSchoolsFilter";
import getClassFilters from "./getClassFilters";

export default function() {
    schedulesTimeView();
    sleep(5);
    scheduleFilterProgram();
    // sleep(5);
    // scheduleFilterClass();
    sleep(0.5);
    getSchoolsFilter();
    getClassFilters();
    
    //this function checks the permission for teachers. 
    meMembershipsForTeacher();
  


}
