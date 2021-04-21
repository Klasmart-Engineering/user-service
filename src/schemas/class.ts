import gql from 'graphql-tag'
import { Model } from '../model'
import { ApolloServerExpressConfig } from 'apollo-server-express'

const typeDefs = gql`
    extend type Mutation {
        classes: [Class]
        class(class_id: ID!): Class
        uploadClassesFromCSV(file: Upload!): File
            @isMIMEType(mimetype: "text/csv")
    }
    extend type Query {
        classes: [Class]
        classes_v1(
            after: String
            before: String
            first: Int
            last: Int
        ): ClassConnection! @isAdmin(entity: "class")

        class(class_id: ID!): Class
    }
    type Class {
        class_id: ID!

        #properties
        class_name: String
        status: Status
        shortcode: String
        #connections
        organization: Organization
        schools: [School]
        teachers: [User]
        students: [User]
        # schedule: [ScheduleEntry]

        # query
        programs: [Program!]
        age_ranges: [AgeRange!]
        grades: [Grade!]
        subjects: [Subject!]
        eligibleTeachers: [User]
        eligibleStudents: [User]

        #mutations
        set(class_name: String, shortcode: String): Class
        addTeacher(user_id: ID!): User
        editTeachers(teacher_ids: [ID!]): [User]
        removeTeacher(user_id: ID!): Boolean
        addStudent(user_id: ID!): User
        editStudents(student_ids: [ID!]): [User]
        removeStudent(user_id: ID!): Boolean
        editSchools(school_ids: [ID!]): [School]
        addSchool(school_id: ID!): School
        editPrograms(program_ids: [ID!]): [Program]
        editAgeRanges(age_range_ids: [ID!]): [AgeRange]
        editGrades(grade_ids: [ID!]): [Grade]
        editSubjects(subject_ids: [ID!]): [Subject]
        removeSchool(school_id: ID!): Boolean

        delete(_: Int): Boolean
        # addSchedule(id: ID!, timestamp: Date): Boolean
        # removeSchedule(id: ID!): Boolean
    }
    type ClassConnection {
        total: Int
        edges: [Class]!
        pageInfo: PageInfo!
    }
`
export default function getDefault(
    model: Model,
    context?: any
): ApolloServerExpressConfig {
    return {
        typeDefs: [typeDefs],
        resolvers: {
            Mutation: {
                classes: () => model.getClasses(),
                class: (_parent, args, _context, _info) => model.getClass(args),
                uploadClassesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadClassesFromCSV(args, ctx, info),
            },
            Query: {
                class: (_parent, args, _context, _info) => model.getClass(args),
                classes: () => model.getClasses(),
                classes_v1: (_parent, args, ctx, _info) =>
                    model.v1_getClasses(ctx, args),
            },
        },
    }
}
