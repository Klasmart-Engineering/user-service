import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'
import { Connection } from "typeorm"
import { Role } from '../src/entities/role';
import { User } from '../src/entities/user';
import { Model } from "../src/model";
import { studentRole } from '../src/permissions/student';
import { superAdminRole } from '../src/permissions/superAdmin';
import { teacherRole } from '../src/permissions/teacher';
import { createServer } from "../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from './utils/createTestClient';
import { createUser } from './utils/operations/modelOps';
import { addRoleToOrganizationMembership } from './utils/operations/organizationMembershipOps';
import { addOrganizationToUser } from './utils/operations/userOps';
import { createTestConnection } from './utils/testConnection';

const USER_INFO_FILE = path.join(__dirname, './fixtures/userInfo.csv')
const STUDENT_INFO_FILE = path.join(__dirname, './fixtures/studentInfo.csv')

interface UserInfo {
    name: string
    email: string
    birthday: string | undefined
    role: string
}

describe("migrate", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;

    before(async () => {
        connection = await createTestConnection(true);
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    it("creates new user entires in the database", async () => {
        const userInfoEntries = await getUserInfoEntriesFromCsv();
        await migrateUsers(testClient, userInfoEntries);
    });

    it("creates new student entires in the database", async () => {
        const userInfoEntries = await getStudentInfoEntriesFromCsv();
        await migrateUsers(testClient, userInfoEntries);
    });
});

async function migrateUsers(testClient: ApolloServerTestClient, userInfoEntries: UserInfo[]) {
    const organizationId = "740ec808-bd56-46c6-8bcb-babbe1666dc4";
    const orgStudentRole = await Role.findOneOrFail({
        where: {
            organization: organizationId,
            role_name: studentRole.role_name,
        },
    });
    const orgTeacherRole = await Role.findOneOrFail({
        where: {
            organization: organizationId,
            role_name: teacherRole.role_name,
        },
    });
    const orgSuperAdminRole = await Role.findOneOrFail({
        where: {
            organization: organizationId,
            role_name: superAdminRole.role_name,
        },
    });

    for (const x of userInfoEntries) {
        const existingUserCount = await User.count({ where: { email: x.email } });

        if (existingUserCount > 0) continue;
        if (x.role === 'PARENT') continue;

        const user = await createUser(testClient, { given_name: x.name, email: x.email } as User, { authorization: undefined });
        await addOrganizationToUser(testClient, user.user_id, organizationId);
        
        switch (x.role) {
            case 'super':
                addRoleToOrganizationMembership(testClient, user.user_id, organizationId, orgSuperAdminRole.role_id);
                break;
            case 'teacher':
                addRoleToOrganizationMembership(testClient, user.user_id, organizationId, orgTeacherRole.role_id);
                break;
            case 'student':
                addRoleToOrganizationMembership(testClient, user.user_id, organizationId, orgStudentRole.role_id);
                break;
            default:
                console.log(`Unexpected role encountered: ${x.role}. Won't add a role for user ${x.email}.`);
                break;
        }
    }
}

async function getUserInfoEntriesFromCsv() {
    const userInfoEntries: UserInfo[] = []

    const _ = await new Promise(resolve =>
        fs
            .createReadStream(USER_INFO_FILE)
            .pipe(csvParser())
            .on('data', (row: any) => {
                if (row['deleted'] === 'FALSE' && row['deleted_by_kbt'] === 'FALSE') {
                    const birthDateString = getBirthDate(row['birthday'])
                    userInfoEntries.push({
                        name: row['name'],
                        email: row['email'],
                        birthday: birthDateString,
                        role: row['role'],
                    })
                }

                return row
            })
            .on('end', resolve)
    );

    return userInfoEntries
}

async function getStudentInfoEntriesFromCsv() {
    const studentInfoEntries: UserInfo[] = []

    const _ = await new Promise(resolve =>
        fs
            .createReadStream(STUDENT_INFO_FILE)
            .pipe(csvParser())
            .on('data', (row: any) => {
                if (row['deleted'] === 'FALSE' && row['parent_deleted'] === 'FALSE' && row['parent_deleted_by_kbt'] === 'FALSE') {
                    const birthDateString = getBirthDate(row['birthday'])
                    studentInfoEntries.push({
                        name: row['student_name'],
                        email: row['parent_email'],
                        birthday: birthDateString,
                        role: "student",
                    })
                }

                return row
            })
            .on('end', resolve)
    );

    return studentInfoEntries
}

function getBirthDate(unixTime: number) {
    try {
        if (unixTime > 0) {
            const birthDate = new Date(unixTime * 1000)
            return dateToMMYYYY(birthDate)
        }
    }
    catch(e) {
        console.log(e)
    }
}

function dateToMMYYYY(date: Date) {
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    return (month <= 9 ? '0' + month : month) + '-' + '-' + year;
}
