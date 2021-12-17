import { sleep } from "k6";
import switchUser from "./switchUser";
import testLogin from "./testLogin";
import hitHomeRequest6 from "./hitHomeRequest6";

export default function() {
    testLogin();
    sleep(2);
    switchUser();
    sleep(1);
    hitHomeRequest6('Org admin');

    
}