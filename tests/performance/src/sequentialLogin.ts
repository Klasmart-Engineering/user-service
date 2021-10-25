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
    sleep(3);
    userSchoolAdminLogin();
    sleep(3);
    userTeacherLogin();
    sleep(3);
    userStudentLogin();
    sleep(3);
    userParentLogin();
}
