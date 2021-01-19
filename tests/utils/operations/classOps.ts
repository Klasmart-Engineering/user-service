import { Class } from "../../../src/entities/class";
import { School } from "../../../src/entities/school";
import { User } from "../../../src/entities/user";
import { ApolloServerTestClient } from "../createTestClient";
import { Headers } from 'node-mocks-http';
import { gqlTry } from "../gqlTry";

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

const ELIGIBLE_TEACHERS = `
    query myQuery($class_id: ID!) {
        class(class_id: $class_id) {
            eligibleTeachers {
                user_id
            }
        }
    }
`;

const ELIGIBLE_STUDENTS = `
    query myQuery($class_id: ID!) {
        class(class_id: $class_id) {
            eligibleStudents {
                user_id
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

const REMOVE_TEACHER = `
    mutation myMutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            removeTeacher(user_id: $user_id)
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

const REMOVE_STUDENT = `
    mutation myMutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            removeStudent(user_id: $user_id)
        }
    }
`;

const EDIT_TEACHERS_IN_CLASS = `
    mutation myEditTeachers(
            $class_id: ID!
            $teacher_ids: [ID!]) {
        class(class_id: $class_id) {
            editTeachers(teacher_ids: $teacher_ids) {
                user_id
            }
        }
    }
`;

const EDIT_STUDENTS_IN_CLASS = `
    mutation myEditStudents(
            $class_id: ID!
            $student_ids: [ID!]) {
        class(class_id: $class_id) {
            editStudents(student_ids: $student_ids) {
                user_id
            }
        }
    }
`;

const EDIT_SCHOOLS_IN_CLASS = `
    mutation myEditStudents(
            $class_id: ID!
            $school_ids: [ID!]) {
        class(class_id: $class_id) {
            editSchools(school_ids: $school_ids) {
                school_id
            }
        }
    }
`;

const REMOVE_SCHOOL = `
    mutation myMutation(
            $class_id: ID!
            $school_id: ID!) {
        class(class_id: $class_id) {
            removeSchool(school_id: $school_id)
        }
    }
`;

const DELETE_CLASS = `
    mutation myMutation($class_id: ID!) {
        class(class_id: $class_id) {
            delete
        }
    }
`;

export async function updateClass(testClient: ApolloServerTestClient, classId: string, className: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: UPDATE_CLASS,
        variables: { class_id: classId, class_name: className },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlClass = res.data?.class.set as Class;
    return gqlClass;
}

export async function eligibleTeachers(testClient: ApolloServerTestClient, classId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: ELIGIBLE_TEACHERS,
        variables: { class_id: classId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlTeachers = res.data?.class.eligibleTeachers as User[];
    return gqlTeachers;
}

export async function eligibleStudents(testClient: ApolloServerTestClient, classId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: ELIGIBLE_STUDENTS,
        variables: { class_id: classId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlStudents = res.data?.class.eligibleStudents as User[];
    return gqlStudents;
}

export async function addSchoolToClass(testClient: ApolloServerTestClient, classId: string, schoolId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: ADD_SCHOOL_TO_CLASS,
        variables: { class_id: classId, school_id: schoolId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const school = res.data?.class.addSchool as School;
    return school;
}

export async function editTeachersInClass(testClient: ApolloServerTestClient, classId: string, teacherIds: string[], headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: EDIT_TEACHERS_IN_CLASS,
        variables: { class_id: classId, teacher_ids: teacherIds },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const teachers = res.data?.class.editTeachers as User[];
    return teachers;
}

export async function addTeacherToClass(testClient: ApolloServerTestClient, classId: string, userId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: ADD_TEACHER_TO_CLASS,
        variables: { class_id: classId, user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const teacher = res.data?.class.addTeacher as User;
    return teacher;
}

export async function removeTeacherInClass(testClient: ApolloServerTestClient, classId: string, userId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: REMOVE_TEACHER,
        variables: { class_id: classId, user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const successful = res.data?.class.removeTeacher as boolean;
    return successful;
}

export async function editStudentsInClass(testClient: ApolloServerTestClient, classId: string, studentIds: string[], headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: EDIT_STUDENTS_IN_CLASS,
        variables: { class_id: classId, student_ids: studentIds },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const students = res.data?.class.editStudents as User[];
    return students;
}

export async function addStudentToClass(testClient: ApolloServerTestClient, classId: string, userId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: ADD_STUDENT_TO_CLASS,
        variables: { class_id: classId, user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const student = res.data?.class.addStudent as User;
    return student;
}

export async function removeStudentInClass(testClient: ApolloServerTestClient, classId: string, userId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: REMOVE_STUDENT,
        variables: { class_id: classId, user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const successful = res.data?.class.removeStudent as boolean;
    return successful;
}

export async function editSchoolsInClass(testClient: ApolloServerTestClient, classId: string, schoolIds: string[], headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: EDIT_SCHOOLS_IN_CLASS,
        variables: { class_id: classId, school_ids: schoolIds },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const schools = res.data?.class.editSchools as School[];
    return schools;
}

export async function removeSchoolFromClass(testClient: ApolloServerTestClient, classId: string, schoolId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: REMOVE_SCHOOL,
        variables: { class_id: classId, school_id: schoolId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const successful = res.data?.class.removeSchool as boolean;
    return successful;
}

export async function deleteClass(testClient: ApolloServerTestClient, classId: string, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: DELETE_CLASS,
        variables: { class_id: classId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const successful = res.data?.class.delete as boolean;
    return successful;
}
