import { sleep } from "k6";
import switchUser from "./switchUser";
import testLogin from "./testLogin";
import hitHomeRequest3 from "./hitHomeRequest3";

export default function() {
    testLogin();
    sleep(2);
    switchUser();
    sleep(1);
    hitHomeRequest3('Org admin');


}