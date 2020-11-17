import { expect } from "chai";
import { Class } from "../../../src/entities/class";
import { School } from "../../../src/entities/school";
import { User } from "../../../src/entities/user";
import { ApolloServerTestClient } from "../createTestClient";
import { AuthToken } from "../testConfig";

const UPDATE_CLASS = `
    mutation myMutation(
            $class_id: ID!
            $class_name: String) {
        class(class_id: $class_id) {
            set(class_name: $class_name) {
                class_id
                class_name
            }
        }
    }
`;

const ADD_SCHOOL_TO_CLASS = `
    mutation myMutation(
            $class_id: ID!
            $school_id: ID!) {
        class(class_id: $class_id) {
            addSchool(school_id: $school_id) {
                school_id
                school_name
            }
        }
    }
`;

const ADD_TEACHER_TO_CLASS = `
    mutation myMutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            addTeacher(user_id: $user_id) {
                user_id
            }
        }
    }
`;

const ADD_STUDENT_TO_CLASS = `
    mutation myMutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            addStudent(user_id: $user_id) {
                user_id
            }
        }
    }
`;

export async function updateClass(testClient: ApolloServerTestClient, classId: string, className: string) {
    const { mutate } = testClient;

    const res = await mutate({
        mutation: UPDATE_CLASS,
        variables: { class_id: classId, class_name: className },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlClass = res.data?.class.set as Class;

    return gqlClass;
}

export async function addSchoolToClass(testClient: ApolloServerTestClient, classId: string, schoolId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_SCHOOL_TO_CLASS,
        variables: { class_id: classId, school_id: schoolId },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const school = res.data?.class.addSchool as School;
    return school;
}

export async function addTeacherToClass(testClient: ApolloServerTestClient, classId: string, userId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_TEACHER_TO_CLASS,
        variables: { class_id: classId, user_id: userId },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const teacher = res.data?.class.addTeacher as User;
    return teacher;
}

export async function addStudentToClass(testClient: ApolloServerTestClient, classId: string, userId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_STUDENT_TO_CLASS,
        variables: { class_id: classId, user_id: userId },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const student = res.data?.class.addStudent as User;
    return student;
}