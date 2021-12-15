import { sleep } from "k6";
import switchUser from "./switchUser";
import testLogin from "./testLogin";
import hitHomeRequest4 from "./hitHomeRequest4";

export default function() {
    testLogin();
    sleep(2);
    switchUser();
    sleep(1);
    hitHomeRequest4('Org admin');


}