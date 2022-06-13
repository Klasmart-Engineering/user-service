import { AgeRange } from '../../../src/entities/ageRange'
import { Class } from '../../../src/entities/class'
import { Grade } from '../../../src/entities/grade'
import { Program } from '../../../src/entities/program'
import { School } from '../../../src/entities/school'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import { ApolloServerTestClient } from '../createTestClient'
import { Headers } from 'node-mocks-http'
import { gqlTry } from '../gqlTry'
import { gql } from 'graphql-tag'

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
`

const ELIGIBLE_TEACHERS = `
    query myQuery($class_id: ID!) {
        class(class_id: $class_id) {
            eligibleTeachers {
                user_id
            }
        }
    }
`

const ELIGIBLE_STUDENTS = `
    query myQuery($class_id: ID!) {
        class(class_id: $class_id) {
            eligibleStudents {
                user_id
            }
        }
    }
`

export const ADD_SCHOOL_TO_CLASS = `
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
`

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
`

const REMOVE_TEACHER = `
    mutation myMutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            removeTeacher(user_id: $user_id)
        }
    }
`

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
`

const REMOVE_STUDENT = `
    mutation myMutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            removeStudent(user_id: $user_id)
        }
    }
`

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
`

export const EDIT_STUDENTS_IN_CLASS = `
    mutation myEditStudents(
            $class_id: ID!
            $student_ids: [ID!]) {
        class(class_id: $class_id) {
            editStudents(student_ids: $student_ids) {
                user_id
            }
        }
    }
`

export const EDIT_SCHOOLS_IN_CLASS = `
    mutation myEditStudents(
            $class_id: ID!
            $school_ids: [ID!]) {
        class(class_id: $class_id) {
            editSchools(school_ids: $school_ids) {
                school_id
            }
        }
    }
`

const LIST_PROGRAMS = `
    mutation listPrograms($id: ID!) {
       class(class_id: $id) {
          programs {
            id
            name
            age_ranges {
               id
            }
            grades {
               id
            }
            subjects {
               id
            }
            system
          }
       }
    }
`

const LIST_AGE_RANGES = `
    mutation listAgeRanges($id: ID!) {
       class(class_id: $id) {
          age_ranges {
            id
            name
            system
          }
       }
    }
`

const LIST_GRADES = `
    mutation listGrades($id: ID!) {
       class(class_id: $id) {
          grades {
            id
            name
            system
          }
       }
    }
`

const LIST_SUBJECTS = `
    mutation listSubjects($id: ID!) {
       class(class_id: $id) {
          subjects {
            id
            name
            system
          }
       }
    }
`

export const EDIT_PROGRAM_CLASS = `
    mutation editProgramClass($id: ID!, $program_ids: [ID!]) {
       class(class_id: $id) {
          editPrograms(program_ids: $program_ids) {
            id
            name
          }
       }
    }
`

export const EDIT_AGE_RANGE_CLASS = `
    mutation editAgeRangesClass($id: ID!, $age_range_ids: [ID!]) {
       class(class_id: $id) {
          editAgeRanges(age_range_ids: $age_range_ids) {
            id
            name
          }
       }
    }
`

export const EDIT_GRADES_CLASS = `
    mutation editGradesClass($id: ID!, $grade_ids: [ID!]) {
       class(class_id: $id) {
          editGrades(grade_ids: $grade_ids) {
            id
            name
          }
       }
    }
`

export const EDIT_SUBJECTS_CLASS = `
    mutation editSubjectsClass($id: ID!, $subject_ids: [ID!]) {
       class(class_id: $id) {
          editSubjects(subject_ids: $subject_ids) {
            id
            name
          }
       }
    }
`

const REMOVE_SCHOOL = `
    mutation myMutation(
            $class_id: ID!
            $school_id: ID!) {
        class(class_id: $class_id) {
            removeSchool(school_id: $school_id)
        }
    }
`

export const DELETE_CLASS = `
    mutation myMutation($class_id: ID!) {
        class(class_id: $class_id) {
            delete
        }
    }
`

const CLASSES_MUTATION_RESULT = `classes {
                id
                name
                status
                shortCode
                programs {
                    name
                }
            }
`

export const CLASSES = `
    query myQuery {
        classes {
            class_id
            class_name
        }
    }
`

export const CLASSES_STUDENTS = `
    query myQuery {
        classes {
            students {
                user_id
            }
        }
    }
`

export const CLASSES_TEACHERS = `
    query myQuery {
        classes {
            teachers {
                user_id
            }
        }
    }
`

export const MOVE_TEACHERS_TO_CLASS = gql`
    mutation myMutation($input: MoveUsersToClassInput!) {
        moveTeachersToClass(input: $input) {
            fromClass {
                name
                id
                teachersConnection {
                    edges {
                        node {
                            id
                            givenName
                            familyName
                            contactInfo {
                                email
                                phone
                            }
                        }
                    }
                }
            }
            toClass {
                name
                id
                teachersConnection {
                    edges {
                        node {
                            id
                            givenName
                            familyName
                            contactInfo {
                                email
                                phone
                            }
                        }
                    }
                }
            }
        }
    }
`

export const MOVE_STUDENTS_TO_CLASS = gql`
    mutation myMutation($input: MoveUsersToClassInput!) {
        moveStudentsToClass(input: $input) {
            fromClass {
                name
                id
                studentsConnection {
                    edges {
                        node {
                            id
                            givenName
                            familyName
                            contactInfo {
                                email
                                phone
                            }
                        }
                    }
                }
            }
            toClass {
                name
                id
                studentsConnection {
                    edges {
                        node {
                            id
                            givenName
                            familyName
                            contactInfo {
                                email
                                phone
                            }
                        }
                    }
                }
            }
        }
    }
`

export const DELETE_CLASSES = `
    mutation myMutation($input: [DeleteClassInput!]!) {
        deleteClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const ADD_PROGRAMS_TO_CLASSES = gql`
    mutation myMutation($input: [AddProgramsToClassInput!]!) {
        addProgramsToClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const ADD_STUDENTS_TO_CLASSES = gql`
    mutation myMutation($input: [AddStudentsToClassInput!]!) {
        addStudentsToClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const REMOVE_STUDENTS_FROM_CLASSES = gql`
    mutation myMutation($input: [RemoveStudentsFromClassInput!]!) {
        removeStudentsFromClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const ADD_TEACHERS_TO_CLASSES = gql`
    mutation myMutation($input: [AddTeachersToClassInput!]!) {
        addTeachersToClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const REMOVE_TEACHERS_FROM_CLASSES = gql`
    mutation myMutation($input: [RemoveTeachersFromClassInput!]!) {
        removeTeachersFromClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const CREATE_CLASSES = `mutation($input: [CreateClassInput!]!) {
    createClasses(input: $input) {
        ${CLASSES_MUTATION_RESULT}
    }
}`

export const UPDATE_CLASSES = `mutation($input: [UpdateClassInput!]!) {
    updateClasses(input: $input) {
        ${CLASSES_MUTATION_RESULT}
    }
}`

export const ADD_SUBJECTS_TO_CLASSES = gql`
    mutation myMutation($input: [AddSubjectsToClassInput!]!) {
        addSubjectsToClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const REMOVE_PROGRAMS_FROM_CLASSES = gql`
    mutation RemovePrograms($input: [RemoveProgramsFromClassInput!]!) {
        removeProgramsFromClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const SET_ACADEMIC_TERMS_OF_CLASSES = gql`mutation($input: [SetAcademicTermOfClassInput!]!) {
    setAcademicTermsOfClasses(input: $input) {
        ${CLASSES_MUTATION_RESULT}
    }
}`

export const ADD_AGE_RANGES_TO_CLASSES = gql`
    mutation AddAgeRangesToClasses($input: [AddAgeRangesToClassInput!]!) {
        addAgeRangesToClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const REMOVE_AGE_RANGES_FROM_CLASSES = gql`
    mutation RemoveAgeRangesFromClasses($input: [RemoveAgeRangesFromClassInput!]!) {
        removeAgeRangesFromClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const REMOVE_SUBJECTS_FROM_CLASSES = gql`
    mutation myMutation($input: [RemoveSubjectsFromClassInput!]!) {
        removeSubjectsFromClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const ADD_GRADES_TO_CLASSES = gql`
    mutation AddGradesToClass($input: [AddGradesToClassInput!]!) {
        addGradesToClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export const REMOVE_GRADES_FROM_CLASSES = gql`
    mutation RemoveGradesFromClass($input: [RemoveGradesFromClassInput!]!) {
        removeGradesFromClasses(input: $input) {
            ${CLASSES_MUTATION_RESULT}
        }
    }
`

export async function updateClass(
    testClient: ApolloServerTestClient,
    classId: string,
    className: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: UPDATE_CLASS,
            variables: { class_id: classId, class_name: className },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlClass = res.data?.class.set as Class
    return gqlClass
}

export async function eligibleTeachers(
    testClient: ApolloServerTestClient,
    classId: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: ELIGIBLE_TEACHERS,
            variables: { class_id: classId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlTeachers = res.data?.class.eligibleTeachers as User[]
    return gqlTeachers
}

export async function eligibleStudents(
    testClient: ApolloServerTestClient,
    classId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: ELIGIBLE_STUDENTS,
            variables: { class_id: classId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlStudents = res.data?.class.eligibleStudents as User[]
    return gqlStudents
}

export async function addSchoolToClass(
    testClient: ApolloServerTestClient,
    classId: string,
    schoolId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: ADD_SCHOOL_TO_CLASS,
            variables: { class_id: classId, school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const school = res.data?.class.addSchool as School
    return school
}

export async function editTeachersInClass(
    testClient: ApolloServerTestClient,
    classId: string,
    teacherIds: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_TEACHERS_IN_CLASS,
            variables: { class_id: classId, teacher_ids: teacherIds },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const teachers = res.data?.class.editTeachers as User[]
    return teachers
}

export async function addTeacherToClass(
    testClient: ApolloServerTestClient,
    classId: string,
    userId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: ADD_TEACHER_TO_CLASS,
            variables: { class_id: classId, user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const teacher = res.data?.class.addTeacher as User
    return teacher
}

export async function removeTeacherInClass(
    testClient: ApolloServerTestClient,
    classId: string,
    userId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: REMOVE_TEACHER,
            variables: { class_id: classId, user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const successful = res.data?.class.removeTeacher as boolean
    return successful
}

export async function editStudentsInClass(
    testClient: ApolloServerTestClient,
    classId: string,
    studentIds: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_STUDENTS_IN_CLASS,
            variables: { class_id: classId, student_ids: studentIds },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const students = res.data?.class.editStudents as User[]
    return students
}

export async function addStudentToClass(
    testClient: ApolloServerTestClient,
    classId: string,
    userId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: ADD_STUDENT_TO_CLASS,
            variables: { class_id: classId, user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const student = res.data?.class.addStudent as User
    return student
}

export async function removeStudentInClass(
    testClient: ApolloServerTestClient,
    classId: string,
    userId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: REMOVE_STUDENT,
            variables: { class_id: classId, user_id: userId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const successful = res.data?.class.removeStudent as boolean
    return successful
}

export async function editSchoolsInClass(
    testClient: ApolloServerTestClient,
    classId: string,
    schoolIds: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_SCHOOLS_IN_CLASS,
            variables: { class_id: classId, school_ids: schoolIds },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const schools = res.data?.class.editSchools as School[]
    return schools
}

export async function removeSchoolFromClass(
    testClient: ApolloServerTestClient,
    classId: string,
    schoolId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: REMOVE_SCHOOL,
            variables: { class_id: classId, school_id: schoolId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const successful = res.data?.class.removeSchool as boolean
    return successful
}

export async function listPrograms(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: LIST_PROGRAMS,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlPrograms = res.data?.class.programs as Program[]

    return gqlPrograms
}

export async function listAgeRanges(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: LIST_AGE_RANGES,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlAgeRanges = res.data?.class.age_ranges as AgeRange[]

    return gqlAgeRanges
}

export async function listGrades(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: LIST_GRADES,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlGrades = res.data?.class.grades as Grade[]

    return gqlGrades
}

export async function listSubjects(
    testClient: ApolloServerTestClient,
    id: string,
    headers?: Headers
) {
    const { query } = testClient

    const operation = () =>
        query({
            query: LIST_SUBJECTS,
            variables: { id: id },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubjects = res.data?.class.subjects as Subject[]

    return gqlSubjects
}

export async function editPrograms(
    testClient: ApolloServerTestClient,
    id: string,
    program_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_PROGRAM_CLASS,
            variables: { id: id, program_ids: program_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlPrograms = res.data?.class?.editPrograms as Program[]
    return gqlPrograms
}

export async function editAgeRanges(
    testClient: ApolloServerTestClient,
    id: string,
    age_range_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_AGE_RANGE_CLASS,
            variables: { id: id, age_range_ids: age_range_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlAgeRanges = res.data?.class?.editAgeRanges as AgeRange[]
    return gqlAgeRanges
}

export async function editGrades(
    testClient: ApolloServerTestClient,
    id: string,
    grade_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_GRADES_CLASS,
            variables: { id: id, grade_ids: grade_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlGrades = res.data?.class?.editGrades as Grade[]
    return gqlGrades
}

export async function editSubjects(
    testClient: ApolloServerTestClient,
    id: string,
    subject_ids: string[],
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: EDIT_SUBJECTS_CLASS,
            variables: { id: id, subject_ids: subject_ids },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const gqlSubjects = res.data?.class?.editSubjects as Subject[]
    return gqlSubjects
}

export async function deleteClass(
    testClient: ApolloServerTestClient,
    classId: string,
    headers?: Headers
) {
    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: DELETE_CLASS,
            variables: { class_id: classId },
            headers: headers,
        })

    const res = await gqlTry(operation)
    const successful = res.data?.class.delete as boolean
    return successful
}
