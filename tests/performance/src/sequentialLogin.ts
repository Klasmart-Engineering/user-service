import userOrgAdminLogin from './scripts/userOrgAdminLogin';
import userSchoolAdminLogin from './scripts/userSchoolAdminLogin';
import userTeacherLogin from './scripts/userTeacherLogin';
import userStudentLogin from './scripts/userStudentLogin';
import userParentLogin from './scripts/userParentLogin';
import { sleep } from 'k6';
import { Options } from 'k6/options';

export const options: Options = {
    vus: 1,
};

export default function() {
    userOrgAdminLogin();
    sleep(1);
    userSchoolAdminLogin();
    sleep(1);
    userTeacherLogin();
    sleep(1);
    userStudentLogin();
    sleep(1);
    userParentLogin();
}
