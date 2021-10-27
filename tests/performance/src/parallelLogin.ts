import userOrgAdminLogin from './scripts/userOrgAdminLogin';
import userSchoolAdminLogin from './scripts/userSchoolAdminLogin';
import userTeacherLogin from './scripts/userTeacherLogin';
import userStudentLogin from './scripts/userStudentLogin';
import userParentLogin from './scripts/userParentLogin';
import { Options } from 'k6/options';

export const options: Options = {
    scenarios: {
        // orgAdmin: {
        //     executor: 'ramping-vus',
        //     exec: 'userOrgAdminLogin',
        //     startTime: '0s',
        //     gracefulStop: '5s',
        //     stages: [
        //         {
        //             duration: '10s',
        //             target: 10
        //         },
        //         {
        //             duration: '20s',
        //             target: 30
        //         },
        //         {
        //             duration: '40s',
        //             target: 40
        //         },
        //         {
        //             duration: '20s',
        //             target: 30
        //         },
        //         {
        //             duration: '10s',
        //             target: 10
        //         },
        //         {
        //             duration: '20s',
        //             target: 30
        //         },
        //     ],
        // },
        // schoolAdmin: {
        //     executor: 'shared-iterations',
        //     exec: 'userSchoolAdminLogin',
        //     startTime: '0s',
        //     gracefulStop: '5s',
        //     vus: 10,
        //     iterations: 20,
        //     maxDuration: '4m',
        // },
        teacher: {
            executor: 'ramping-vus',
            exec: 'userTeacherLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 20
                },
                // Hold
                {
                    duration: '2m',
                    target: 20
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 5
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
                    target: 30
                },
                // Hold
                {
                    duration: '2m',
                    target: 235
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 20
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