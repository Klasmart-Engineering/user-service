import { sleep } from "k6";
import schedulesTimeViewDay from "./schedulesTimeViewDay";
import schedulesTimeViewMonth from "./schedulesTimeViewMonth";
import getSchoolsFilter from "./getSchoolsFilter";
import getClassFilters from "./getClassFilters";
import scheduleFilterProgram from "./scheduleFilterProgram";
import meMembershipsForStudents from "./meMembershipsForStudents";

export default function() {
    schedulesTimeViewMonth(); // CMS service - Ok
    scheduleFilterProgram(); // CMS service - Ok
    //sleep(0.5);
    // schedulesTimeViewDay(); // CMS service
    // sleep(5);
    // scheduleFilterClass();
    getSchoolsFilter(); // User service - ok
    getClassFilters(); //  User service - ok
    
    //this function checks the permission for teachers. 
    meMembershipsForStudents(); // 6 Requests
}
