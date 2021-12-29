const path = require(`path`);
const Dotenv = require(`dotenv-webpack`);
const { CleanWebpackPlugin } = require(`clean-webpack-plugin`);

module.exports = {
    mode: `production`,
    context: path.join(__dirname, `src`),
    entry: {
        parallelLogin: `./parallelLogin.ts`,
        createUserBasic: `./createUserBasic`,
        createUsersAllRoles: `./createUsersAllRoles`,
        create1kUsers: `./create1kUsers`,
        createUsersParallel: `./createUsersParallel`,
        parallelLanding: `./parallelLanding.ts`,
        parallelLandingSchedule: `./parallelLandingSchedule.ts`,
        getPaginatedUsers: `./getPaginatedUsers.ts`,
        getPaginatedUsersCursor: `./getPaginatedUsersCursor.ts`,
        getPaginatedUsersFilter: `./getPaginatedUsersFilters.ts`,
        getPaginatedUsersMixed: `./getPaginatedUsersMixed.ts`,
        scenario9ASchoolAdmin: `./Scenarios/Scenario 9/scenario9ASchoolAdmin.ts`,
        liveClassPopulate: `./liveClassPopulate.ts`,
        parallelScheduleSearch: `./parallelScheduleSearch.ts`,
        testEndPointLandingHome1: `./testEndPointLandingHome1.ts`,
        testEndPointLandingHome2: `./testEndPointLandingHome2.ts`,
        testEndPointLandingHome3: `./testEndPointLandingHome3.ts`,
        testEndPointLandingHome4: `./testEndPointLandingHome4.ts`,
        testEndPointLandingHome5: `./testEndPointLandingHome5.ts`,
        testEndPointLandingHome6: `./testEndPointLandingHome6.ts`,
        testEndPointLandingHome7: `./testEndPointLandingHome7.ts`,
        testEndPointLandingSchedule1: `./testEndPointLandingSchedule1.ts`,
        testEndPointLandingSchedule2: `./testEndPointLandingSchedule2.ts`,
        testEndPointLandingSchedule3: `./testEndPointLandingSchedule3.ts`,
        testEndPointLandingSchedule4: `./testEndPointLandingSchedule4.ts`,
        testEndPointLandingSchedule5: `./testEndPointLandingSchedule5.ts`,
        testEndPointLandingSchedule6: `./testEndPointLandingSchedule6.ts`,
        testEndPointLandingSchedule7: `./testEndPointLandingSchedule7.ts`,
        testEndPointLandingSchedule8: `./testEndPointLandingSchedule8.ts`,
        testEndPointLandingOrganization2: `./testEndPointLandingOrganization2.ts`,
        testEndPointLandingOrganization3: `./testEndPointLandingOrganization3.ts`,
        testEndPointLandingOrganization5: `./testEndPointLandingOrganization5.ts`,
        testEndPointLandingUser1: `./testEndPointLandingUser1.ts`,
        parallelScheduleFilter: `./parallelScheduleFilter.ts`,
        getRoles: `./getRoles.ts`,
        getRolesPermissions: `./getRolesPermissions.ts`,
        getSchools: `./getSchools.ts`,
        getAgeRanges: `./getAgeRanges.ts`
      
    },
    output: {
        path: path.join(__dirname, `dist`),
        libraryTarget: `commonjs`,
        filename: `[name].js`,
    },
    resolve: {
        extensions: [ `.ts`, `.js` ],
        modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, '../node_modules'),
            'node_modules'
        ]
    },
    module: {
        rules: [
            {
                use: [{ loader: 'babel-loader' }, { loader: 'ts-loader' }],
                test: /\.ts$/,
            },
        ],
    },
    target: `web`,
    externals: /^(k6|https?:\/\/)(\/.*)?/,
    stats: {
        colors: true,
    },
    plugins: [ new CleanWebpackPlugin(), new Dotenv() ],
};
