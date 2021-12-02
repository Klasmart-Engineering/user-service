import userOrgAdminLogin from './scripts/userOrgAdminLogin';
import userSchoolAdminLogin from './scripts/userSchoolAdminLogin';
import userTeacherLogin from './scripts/userTeacherLogin';
import userStudentLogin from './scripts/userStudentLogin';
import userParentLogin from './scripts/userParentLogin';
import { Options } from 'k6/options';
import { config } from './config/parallelLogin';

const stageQty: number = !isNaN(parseInt(__ENV.STAGE_QTY, 10)) ? parseInt(__ENV.STAGE_QTY) : 2;
export const options: Options = config(stageQty);

export {
    userOrgAdminLogin,
    userSchoolAdminLogin,
    userTeacherLogin,
    userStudentLogin,
    userParentLogin
}