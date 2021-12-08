import userOrgAdminLogin from './scripts/userOrgAdminLogin';
import userSchoolAdminLogin from './scripts/userSchoolAdminLogin';
import userTeacherLogin from './scripts/userTeacherLogin';
import userStudentLogin from './scripts/userStudentLogin';
import userParentLogin from './scripts/userParentLogin';
import { Options } from 'k6/options';

export const options: Options = {
    ext: {
        loadimpact: {
          projectID: 3560234,
        },
      },
    
    scenarios: {
         orgAdmin: {
             executor: 'ramping-vus',
             exec: 'userOrgAdminLogin',
             startTime: '0s',
             gracefulStop: '5s',
             stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 3
                },
                // Hold
                {
                    duration: '4m',
                    target: 5
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },     
             ],
         },
         schoolAdmin: {
            executor: "ramping-vus",
            exec: "userSchoolAdminLogin",
            startTime: "0s",
            gracefulStop: "5s",
            stages: [{
              duration: "20s",
              target: 3
            }, {
              duration: "4m",
              target: 5
            }, {
              duration: "20s",
              target: 1
            }]
        },
        teacher: {
            executor: 'ramping-vus',
            exec: 'userTeacherLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 7
                },
                // Hold
                {
                    duration: '4m',
                    target: 10
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        student: {
            executor: 'ramping-vus',
            exec: 'userStudentLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up          
                {
                    duration: '20s',
                    target: 10
                },
                // Hold
                {
                    duration: '4m',
                    target: 200
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        // parent: {
        //     executor: 'constant-vus',
        //     exec: 'userParentLogin',
        //     startTime: '0s',
        //     gracefulStop: '5s',
        //     vus: 10,
        //     duration: '25s',
        // },
    },
}

export {
    userOrgAdminLogin,
    userSchoolAdminLogin,
    userTeacherLogin,
    userStudentLogin,
    userParentLogin
}