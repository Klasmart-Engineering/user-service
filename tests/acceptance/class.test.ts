import { expect, use } from 'chai'
import supertest from 'supertest'
import { getConnection, In } from 'typeorm'
import faker from 'faker'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import { Class } from '../../src/entities/class'
import { Status } from '../../src/entities/status'
import { User } from '../../src/entities/user'
import { AgeRangeConnectionNode } from '../../src/types/graphQL/ageRange'
import {
    SetAcademicTermOfClassInput,
    AddProgramsToClassInput,
    AddStudentsToClassInput,
    AddTeachersToClassInput,
    ClassConnectionNode,
    CreateClassInput,
    DeleteClassInput,
    MoveUsersToClassInput,
    RemoveStudentsFromClassInput,
    RemoveTeachersFromClassInput,
    UpdateClassInput,
} from '../../src/types/graphQL/class'
import { GradeSummaryNode } from '../../src/types/graphQL/grade'
import { SchoolSummaryNode } from '../../src/types/graphQL/school'
import { loadFixtures } from '../utils/fixtures'
import {
    addAgeRangesToClass,
    addGradesToClass,
    addProgramsToClass,
    addSchoolsToClass,
    addSchoolToClass,
    addSubjectsToClass,
    createAgeRanges,
    createGrades,
    createPrograms,
    createSchool,
    createSubjects,
    IAgeRangeDetail,
    inviteUserToOrganization,
} from '../utils/operations/acceptance/acceptanceOps.test'
import {
    SET_ACADEMIC_TERMS_OF_CLASSES,
    ADD_PROGRAMS_TO_CLASSES,
    ADD_STUDENTS_TO_CLASSES,
    ADD_TEACHERS_TO_CLASSES,
    CREATE_CLASSES,
    DELETE_CLASS,
    DELETE_CLASSES,
    MOVE_STUDENTS_TO_CLASS,
    MOVE_TEACHERS_TO_CLASS,
    REMOVE_PROGRAMS_FROM_CLASSES,
    REMOVE_STUDENTS_FROM_CLASSES,
    REMOVE_TEACHERS_FROM_CLASSES,
    UPDATE_CLASSES,
} from '../utils/operations/classOps'
import {
    CLASS_NODE,
    CLASSES_CONNECTION,
    CLASSES_CONNECTION_SCHOOL_CHILD,
} from '../utils/operations/modelOps'
import {
    CREATE_CLASS,
    getSystemRoleIds,
} from '../utils/operations/organizationOps'
import { CREATE_ORGANIZATION, userToPayload } from '../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { print } from 'graphql'
import { Program } from '../../src/entities/program'
import ProgramsInitializer from '../../src/initializers/programs'
import { failsValidation, makeRequest } from './utils'
import { CoreSubjectConnectionNode } from '../../src/pagination/subjectsConnection'
import { CoreProgramConnectionNode } from '../../src/pagination/programsConnection'
import { createUser, createUsers } from '../factories/user.factory'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { createProgram } from '../factories/program.factory'
import {
    createClass as createClassFactory,
    createClasses,
} from '../factories/class.factory'
import { createSchool as createSchoolFactory } from '../factories/school.factory'
import { NIL_UUID } from '../utils/database'
import { generateShortCode } from '../../src/utils/shortcode'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { TestConnection } from '../utils/testConnection'
import {
    createAcademicTerm,
    createSuccessiveAcademicTerms,
} from '../factories/academicTerm.factory'
import { School } from '../../src/entities/school'
import { AcademicTerm } from '../../src/entities/academicTerm'
import { Organization } from '../../src/entities/organization'
import { PermissionName } from '../../src/permissions/permissionNames'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createSchools } from '../factories/school.factory'
import { createRole as createRoleFactory } from '../factories/role.factory'

use(deepEqualInAnyOrder)

interface IClassEdge {
    node: ClassConnectionNode
}

let schoolAdminId: string
let orgMemberId: string
let schoolIds: string[] = []
const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const user2_id = '16046442-75b8-4da5-b3df-aa53a70a13a1'
const org2_name = 'my-org2'
const classesCount = 12
const schoolsCount = 2

let user2: User
let schoolAdmin: User
let schoolAdminSchoolId: string
let orgMember: User
let org1Id: string
let org2Id: string
let class1Ids: string[]
let class2Ids: string[]
let systemProgramIds: string[]

let ageRangeId: string
let schoolId: string
let gradeId: string
let subjectId: string
let programId: string
const ageRangeDetail: IAgeRangeDetail = {
    name: '11 - 12 year(s)',
    low_value: 11,
    low_value_unit: AgeRangeUnit.YEAR,
    high_value: 12,
    high_value_unit: AgeRangeUnit.YEAR,
}

async function createOrg(userId: string, orgName: string, token: string) {
    return request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_ORGANIZATION,
            variables: {
                user_id: userId,
                org_name: orgName,
            },
        })
}

async function createClass(
    organization_id: string,
    class_name: string,
    token: string
) {
    return request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_CLASS,
            variables: {
                organization_id,
                class_name,
            },
        })
}

async function deleteClass(classId: string, token: string) {
    return request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: DELETE_CLASS,
            variables: {
                class_id: classId,
            },
        })
}

describe('acceptance.class', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        const systemRoles = await getSystemRoleIds()
        const schoolAdminRoleId = String(systemRoles['School Admin'])
        await ProgramsInitializer.run()
        const systemPrograms = (await Program.find({
            where: { system: true },
            take: 3,
        })) as Program[]
        systemProgramIds = systemPrograms.map((p) => p.id)

        class1Ids = []
        class2Ids = []
        schoolIds = []

        await loadFixtures('users', connection)
        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        org1Id = createOrg1Data.organization_id

        user2 = await connection.manager.findOneOrFail(User, user2_id)

        const createOrg2Response = await createOrg(
            user2_id,
            org2_name,
            generateToken(userToPayload(user2))
        )

        const createOrg2Data =
            createOrg2Response.body.data.user.createOrganization

        org2Id = createOrg2Data.organization_id

        for (let i = 1; i <= schoolsCount; i++) {
            const createSchoolResponse = await createSchool(
                org1Id,
                `school ${i}`,
                getAdminAuthToken()
            )

            const createSchoolData =
                createSchoolResponse.body.data.organization.createSchool

            schoolIds.push(createSchoolData.school_id)
        }

        schoolAdminSchoolId = schoolIds[0]
        const createSchoolAdminResponse = await inviteUserToOrganization(
            'school',
            'admin',
            'school.admin@gmail.com',
            org1Id,
            'Male',
            getAdminAuthToken(),
            'SHORTY2',
            [schoolAdminRoleId],
            [schoolAdminRoleId],
            [schoolAdminSchoolId]
        )

        const createSchoolAdminData =
            createSchoolAdminResponse.body.data.organization.inviteUser

        schoolAdminId = createSchoolAdminData.user.user_id
        schoolAdmin = await connection.manager.findOneOrFail(
            User,
            schoolAdminId
        )

        const createOrgMemberResponse = await inviteUserToOrganization(
            'organization',
            'member',
            'org.member@gmail.com',
            org1Id,
            'Male',
            getAdminAuthToken(),
            'SHORTY1',
            [schoolAdminRoleId]
        )
        const createOrgMemberData =
            createOrgMemberResponse.body.data.organization.inviteUser

        orgMemberId = createOrgMemberData.user.user_id
        orgMember = await connection.manager.findOneOrFail(User, orgMemberId)

        // Creating Age Range to Filter
        const createAgeRangeResponse = await createAgeRanges(
            org1Id,
            [ageRangeDetail],
            getAdminAuthToken()
        )

        ageRangeId =
            createAgeRangeResponse.body.data.organization
                .createOrUpdateAgeRanges[0].id

        // Creating School to Filter
        const createSchoolResponse = await createSchool(
            org1Id,
            'School One',
            getAdminAuthToken()
        )

        schoolId =
            createSchoolResponse.body.data.organization.createSchool.school_id

        // Creating Grade to Filter
        const createGradeResponse = await createGrades(
            org1Id,
            [{ name: 'Grade One' }],
            getAdminAuthToken()
        )

        gradeId =
            createGradeResponse.body.data.organization.createOrUpdateGrades[0]
                .id

        // Creating Subject to Filter
        const createSubjectResponse = await createSubjects(
            org1Id,
            [{ name: 'Subject One' }],
            getAdminAuthToken()
        )

        subjectId =
            createSubjectResponse.body.data.organization
                .createOrUpdateSubjects[0].id

        // Creating Program to Filter
        const createProgramResponse = await createPrograms(
            org1Id,
            [{ name: 'Program One' }],
            getAdminAuthToken()
        )

        programId =
            createProgramResponse.body.data.organization
                .createOrUpdatePrograms[0].id

        for (let i = 1; i <= classesCount; i++) {
            const org1ClassResponse = await createClass(
                org1Id,
                `class ${i}`,
                getAdminAuthToken()
            )

            const class1Id =
                org1ClassResponse.body.data.organization.createClass.class_id

            class1Ids.push(class1Id)

            await addSchoolToClass(
                class1Id,
                schoolIds[i % 2],
                getAdminAuthToken()
            )

            await addProgramsToClass(
                class1Id,
                systemProgramIds,
                getAdminAuthToken()
            )

            if (i > classesCount / 2) {
                const org2ClassResponse = await createClass(
                    org2Id,
                    `class ${i}`,
                    generateToken(userToPayload(user2))
                )

                const class2Id =
                    org2ClassResponse.body.data.organization.createClass
                        .class_id

                class2Ids.push(class2Id)
            }
        }

        const classes = await connection.manager.find(Class)
        const inactiveClassId = classes[0].class_id

        await deleteClass(inactiveClassId, getAdminAuthToken())
        await addAgeRangesToClass(
            class1Ids[1],
            [ageRangeId],
            getAdminAuthToken()
        )

        await addSchoolsToClass(class1Ids[2], [schoolId], getAdminAuthToken())
        await addGradesToClass(class1Ids[3], [gradeId], getAdminAuthToken())
        await addSubjectsToClass(class1Ids[4], [subjectId], getAdminAuthToken())
    })

    context('classesConnection', () => {
        context('using explict count', async () => {
            async function makeQuery(pageSize: any) {
                return request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: print(CLASSES_CONNECTION),
                        variables: {
                            direction: 'FORWARD',
                            directionArgs: {
                                count: pageSize,
                            },
                        },
                    })
            }

            it('passes validation', async () => {
                const pageSize = 5

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(200)
                const classesConnection = response.body.data.classesConnection
                expect(classesConnection.edges.length).to.equal(pageSize)
            })

            it('fails validation', async () => {
                const response = await makeQuery('not_a_number')
                await failsValidation(response)
            })
        })

        it('queries paginated classes', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount)
        })

        it('queries paginated classes sorted by name', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'name',
                            order: 'ASC',
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount / 2)
        })

        it('queries paginated classes sorted by ID', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        sortArgs: {
                            field: 'id',
                            order: 'DESC',
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount)
        })

        it('queries paginated classes filtering by organization ID', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: org2Id,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(classesCount / 2)
        })

        it('queries paginated classes filtering by class status', async () => {
            const status = Status.INACTIVE

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            status: {
                                operator: 'eq',
                                value: status,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)
        })

        it('queries paginated classes filtering by class ID', async () => {
            const classId = class1Ids[0]

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            id: {
                                operator: 'eq',
                                value: classId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)
        })

        it('queries paginated classes filtering by age range from', async () => {
            const lowValue = ageRangeDetail.low_value
            const lowUnit = ageRangeDetail.low_value_unit
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeValueFrom: {
                                operator: 'eq',
                                value: lowValue,
                            },
                            ageRangeUnitFrom: {
                                operator: 'eq',
                                value: lowUnit,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)

            const classAgeRanges = classesConnection.edges.map(
                (edge: IClassEdge) => edge.node.ageRanges
            )

            classAgeRanges.every((ars: AgeRangeConnectionNode[]) => {
                const lowValues = ars.map((ar) => ar.lowValue)
                const lowUnits = ars.map((ar) => ar.lowValueUnit)

                expect(lowValues).includes(lowValue)
                expect(lowUnits).includes(lowUnit)
            })
        })

        it('queries paginated classes filtering by age range to', async () => {
            const highValue = ageRangeDetail.high_value
            const highUnit = ageRangeDetail.high_value_unit
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeValueTo: {
                                operator: 'eq',
                                value: highValue,
                            },
                            ageRangeUnitTo: {
                                operator: 'eq',
                                value: highUnit,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)

            const classAgeRanges = classesConnection.edges.map(
                (edge: IClassEdge) => edge.node.ageRanges
            )

            classAgeRanges.every((ars: AgeRangeConnectionNode[]) => {
                const highValues = ars.map((ar) => ar.highValue)
                const highUnits = ars.map((ar) => ar.highValueUnit)

                expect(highValues).includes(highValue)
                expect(highUnits).includes(highUnit)
            })
        })

        it('queries paginated classes filtering by school ID', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            schoolId: {
                                operator: 'eq',
                                value: schoolId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)

            const classSchools = classesConnection.edges.map(
                (edge: IClassEdge) => edge.node.schools
            )

            classSchools.every((schools: SchoolSummaryNode[]) => {
                const ids = schools.map((school) => school.id)
                expect(ids).includes(schoolId)
            })
        })

        it('queries paginated classes filtering by grade ID', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            gradeId: {
                                operator: 'eq',
                                value: gradeId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)

            const classGrades = classesConnection.edges.map(
                (edge: IClassEdge) => edge.node.grades
            )

            classGrades.every((grades: GradeSummaryNode[]) => {
                const gradeIds = grades.map((grade) => grade.id)
                expect(gradeIds).includes(gradeId)
            })
        })

        it('queries paginated classes filtering by subject ID', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            subjectId: {
                                operator: 'eq',
                                value: subjectId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)

            const classSubjects = classesConnection.edges.map(
                (edge: IClassEdge) => edge.node.subjects
            )

            classSubjects.every((subjects: CoreSubjectConnectionNode[]) => {
                const subjectIds = subjects.map((subject) => subject.id)
                expect(subjectIds).includes(subjectId)
            })
        })

        it('queries paginated classes filtering by program ID', async () => {
            await addProgramsToClass(
                class1Ids[5],
                [programId],
                getAdminAuthToken()
            )

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            programId: {
                                operator: 'eq',
                                value: programId,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)

            const classPrograms = classesConnection.edges.map(
                (edge: IClassEdge) => edge.node.programs
            )

            classPrograms.every((programs: CoreProgramConnectionNode[]) => {
                const programIds = programs.map((program) => program.id)
                expect(programIds).includes(programId)
            })
        })

        it('queries paginated classes filtering by class name', async () => {
            const search = 'class 1'

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            name: {
                                operator: 'contains',
                                value: search,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(4)
        })

        it('queries paginated classes filtering by academic term', async () => {
            const school = await School.findOneOrFail(schoolId)
            const cls = await Class.findOneOrFail(class1Ids[2])
            const term = await createAcademicTerm(school, {}, [cls]).save()

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            academicTermId: {
                                operator: 'eq',
                                value: term.id,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(1)
            expect(classesConnection.edges).to.have.length(1)
            expect(classesConnection.edges[0].node.id).to.equal(cls.class_id)
        })

        it("returns just the classes that belongs to user's school", async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(schoolAdmin)),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: org1Id,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(
                classesCount / schoolsCount
            )
        })

        it('returns empty classes if the user has not permissions', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(orgMember)),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: org1Id,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(0)
        })

        it('returns empty classes if the user is not owner of the organization', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: org1Id,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(0)
        })

        it('responds with an error if the string filter length is longer than 250 chars', async () => {
            const search =
                'hOfLDx5hwPm1KnwNEaAHUddKjN62yGEk4ZycRB7UjmZXMtm2ODnQCycCmylMDsVDCztWgrepOaQ9itKx94g2rELPj8w533bGpKqUT9a25NuKrzs5R3OfTUprOkCLE1PBHYOAUpSU289e4BhZzR40ncGsKwKtIFHQ9fzy1hlPr3gWMK8H6s5JGtO0oQrl8Lf0co5IlKWRaeEY4eaUUIWVHRiSdsaaXgM5ffW1zgZCrhOYCPZrBrP8uYaiPGsn1GjE8Chf'

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            name: {
                                operator: 'contains',
                                value: search,
                            },
                        },
                    },
                })

            expect(response.status).to.eq(200)
            expect(response.body).to.have.property('errors')
        })

        it('responds with an error if the filter is wrong', async () => {
            const organizationId = 6

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: print(CLASSES_CONNECTION),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: organizationId,
                            },
                        },
                    },
                })

            expect(response.status).to.eq(400)
            expect(response.body).to.have.property('errors')
        })

        it('has schoolsConnection as a child', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(schoolAdmin)),
                })
                .send({
                    query: print(CLASSES_CONNECTION_SCHOOL_CHILD),
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            organizationId: {
                                operator: 'eq',
                                value: org1Id,
                            },
                        },
                    },
                })

            const classesConnection = response.body.data.classesConnection

            // Since there's only one school associated with the school admin,
            // We expect to see just that one school in the school child result
            const actualSchoolNodesWithIds = []
            for (const classNode of classesConnection.edges) {
                const nodeSchoolsConnectionEdges =
                    classNode.node.schoolsConnection.edges
                actualSchoolNodesWithIds.push(nodeSchoolsConnectionEdges)
            }
            const actualSchoolIds = actualSchoolNodesWithIds
                .reduce((acc, val) => acc.concat(val), [])
                .map((obj: { node: any }) => obj.node.id) as string[]
            const uniqueActualSchoolIds = [...new Set(actualSchoolIds)]

            const expectedSchoolIds = [schoolAdminSchoolId]

            expect(response.status).to.eq(200)
            expect(uniqueActualSchoolIds).to.have.same.members(
                expectedSchoolIds
            )
        })

        it('has programsConnection as a child', async () => {
            const user1 = await User.findOneOrFail(user_id)
            const response = await makeRequest(
                request,
                print(CLASSES_CONNECTION),
                { direction: 'FORWARD' },
                generateToken(userToPayload(user1))
            )

            expect(response.status).to.eq(200)

            const classesConnection = response.body.data.classesConnection
            expect(classesConnection.edges).to.have.lengthOf(classesCount)
            classesConnection.edges.forEach((c: IClassEdge) => {
                const programsConnection = c.node.programsConnection
                expect(programsConnection?.edges).to.have.lengthOf(
                    systemProgramIds.length
                )

                const programIds = programsConnection?.edges.map(
                    (p) => p.node.id
                )

                expect(programIds).to.deep.equalInAnyOrder(systemProgramIds)
            })
        })

        it('has gradesConnection as a child', async () => {
            const response = await makeRequest(
                request,
                print(CLASSES_CONNECTION),
                {
                    direction: 'FORWARD',
                    filterArgs: {
                        id: {
                            operator: 'eq',
                            value: class1Ids[3],
                        },
                    },
                },
                getAdminAuthToken()
            )
            const classesConnection = response.body.data.classesConnection
            expect(classesConnection.edges).to.have.lengthOf(1)
            expect(
                classesConnection.edges[0].node.gradesConnection.edges
            ).to.have.lengthOf(1)
            expect(
                classesConnection.edges[0].node.gradesConnection.edges[0].node
                    .id
            ).to.eq(gradeId)
        })
    })

    context('classNode', () => {
        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const classId = class1Ids[0]
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: print(CLASS_NODE),
                        variables: {
                            id: classId,
                        },
                    })

                const classNode = response.body.data.classNode

                expect(response.status).to.eq(200)
                expect(classNode.id).to.equal(classId)
            })
        })

        it("can access the class's academic term", async () => {
            const org1 = await connection.manager.findOneOrFail(
                Organization,
                org1Id
            )
            const school = await createSchoolFactory(org1).save()
            const class_ = createClassFactory([], org1)
            const academicTerm = createAcademicTerm(school)
            await academicTerm.save()
            class_.academicTerm = Promise.resolve(academicTerm)
            await class_.save()

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: `query($id: ID!){
                            classNode(id: $id){
                                academicTerm{
                                    id,
                                    name,
                                    status,
                                    startDate,
                                    endDate,
                                    school{
                                        id
                                    }
                                }
                            }
                        }`,
                    variables: {
                        id: class_.class_id,
                    },
                })

            const classNode = response.body.data.classNode
            expect(response.status).to.eq(200)
            expect(classNode.academicTerm.id).to.eq(academicTerm.id)
            expect(classNode.academicTerm.name).to.eq(academicTerm.name)
            expect(classNode.academicTerm.startDate).to.eq(
                academicTerm.start_date.toISOString()
            )
            expect(classNode.academicTerm.endDate).to.eq(
                academicTerm.end_date.toISOString()
            )
            expect(classNode.academicTerm.school.id).to.eq(school.school_id)
        })

        context(
            "when request is using a param that doesn't exist ('classId' instead of 'id')",
            () => {
                it('should respond with status 400', async () => {
                    const classId = '7h15-15-n07-4n-1d'
                    const response = await request
                        .post('/user')
                        .set({
                            ContentType: 'application/json',
                            Authorization: getAdminAuthToken(),
                        })
                        .send({
                            query: print(CLASS_NODE),
                            variables: {
                                classId,
                            },
                        })

                    const errors = response.body.errors
                    const data = response.body.data

                    expect(response.status).to.eq(400)
                    expect(errors).to.exist
                    expect(data).to.be.undefined
                })
            }
        )
    })

    context('deleteClasses', () => {
        let input: DeleteClassInput[]
        let activeClasses: Class[]

        beforeEach(async () => {
            activeClasses = await connection.manager.find(Class, {
                where: { class_id: In(class1Ids), status: Status.ACTIVE },
            })
        })

        context('when data is requested in a correct way', () => {
            let response: Record<string, any>
            beforeEach(async () => {
                input = activeClasses.map((ac) => {
                    return { id: ac.class_id }
                })
                response = await makeRequest(
                    request,
                    DELETE_CLASSES,
                    { input },
                    getAdminAuthToken()
                )
            })

            it('should respond with status 200', async () => {
                expect(response.status).to.eq(200)
                expect(
                    response.body.data.deleteClasses.classes.length
                ).to.equal(input.length)
            })

            it('should set all classes as inactive', async () => {
                const remainingClasses = await connection.manager.find(Class, {
                    where: { class_id: In(class1Ids), status: Status.ACTIVE },
                })
                expect(remainingClasses.length).to.equal(0)
            })
        })
    })

    context('addProgramsToClasses', () => {
        let adminUser: User
        let input: AddProgramsToClassInput[]
        const programsCount = 20
        const classCount = 50
        const programs: Program[] = []

        const makeAddProgramsToClassesMutation = async (
            input: AddProgramsToClassInput[]
        ) => {
            return makeRequest(
                request,
                print(ADD_PROGRAMS_TO_CLASSES),
                { input },
                generateToken(userToPayload(adminUser))
            )
        }

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            for (let x = 0; x < programsCount; x++) {
                const cls = await createProgram().save()
                programs.push(cls)
            }

            const classes = []
            for (let i = 0; i < classCount; i++) {
                classes.push(await createClassFactory().save())
            }

            input = []
            for (let i = 0; i < classCount; i++) {
                input.push({
                    classId: classes[i].class_id,
                    programIds: programs.slice(8, 15).map((v) => v.id),
                })
            }
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const response = await makeAddProgramsToClassesMutation(input)
                const resClasses =
                    response.body.data.addProgramsToClasses.classes
                expect(response.status).to.eq(200)
                expect(resClasses.length).to.equal(classCount)
            })
        })
        context('when input is sent in an incorrect way', () => {
            it('should respond with errors', async () => {
                input[0].classId = NIL_UUID

                const response = await makeAddProgramsToClassesMutation(input)
                const classesUpdated = response.body.data.addProgramsToClasses
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(classesUpdated).to.be.null
                expect(errors).to.exist
            })
        })
    })

    context('createClasses', () => {
        let input: CreateClassInput[]

        beforeEach(async () => {
            input = [
                {
                    organizationId: org1Id,
                    name: faker.random.word(),
                    shortcode: generateShortCode(),
                },
            ]
        })

        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                CREATE_CLASSES,
                { input },
                getAdminAuthToken()
            )
            expect(response.status).to.eq(200)
            expect(response.body.errors).to.be.undefined
            expect(response.body.data.createClasses.classes).to.have.lengthOf(
                input.length
            )
        })

        it('has mandatory name and organizationId input fields', async () => {
            const response = await makeRequest(
                request,
                CREATE_CLASSES,
                { input: [{}] },
                getAdminAuthToken()
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(2)
            expect(response.body.errors[0].message).to.contain(
                'Field "organizationId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "name" of required type "String!" was not provided.'
            )
        })
    })

    context('updateClasses', () => {
        let input: UpdateClassInput[]
        let classNameUpdated: string
        let classShortcodeUpdated: string
        let activeClass: Class

        beforeEach(async () => {
            activeClass = (
                await connection.manager.find(Class, {
                    where: { class_id: In(class1Ids), status: Status.ACTIVE },
                })
            )[0]

            classNameUpdated = 'Updated Class Name'
            classShortcodeUpdated = 'UPDATEDSC'

            input = [
                {
                    classId: activeClass.class_id,
                    className: classNameUpdated,
                    shortcode: classShortcodeUpdated,
                },
            ]
        })

        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                UPDATE_CLASSES,
                { input },
                getAdminAuthToken()
            )

            expect(response.status).to.eq(200)
            expect(response.body.errors).to.be.undefined
            expect(response.body.data.updateClasses.classes).to.have.lengthOf(
                input.length
            )
        })

        it('has mandatory className input field', async () => {
            const response = await makeRequest(
                request,
                UPDATE_CLASSES,
                { input: [{}] },
                getAdminAuthToken()
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "classId" of required type "ID!" was not provided.'
            )
        })
    })

    context('removeProgramsFromClasses', () => {
        let adminUser: User
        const programsCount = 5
        let programs: Program[]
        let classes: Class[]

        const makeRemoveProgramsFromClassesMutation = async (
            input: any,
            caller: User
        ) => {
            return makeRequest(
                request,
                print(REMOVE_PROGRAMS_FROM_CLASSES),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            const classCount = 10
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()

            programs = await Program.save(
                Array.from(new Array(programsCount), () => createProgram())
            )

            classes = await Class.save(
                Array.from(new Array(classCount), () => {
                    const c = createClassFactory()
                    c.programs = Promise.resolve(programs)
                    return c
                })
            )
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const removeQuantity = programsCount - 2
                const programsToRemove = programs.slice(0, removeQuantity)

                const input = [
                    {
                        classId: classes[0].class_id,
                        programIds: programsToRemove.map((p) => p.id),
                    },
                ]

                const response = await makeRemoveProgramsFromClassesMutation(
                    input,
                    adminUser
                )

                const resClasses =
                    response.body.data.removeProgramsFromClasses.classes

                expect(response.status).to.eq(200)
                expect(resClasses).to.have.lengthOf(input.length)
            })
        })

        it('has mandatory classId and programIds input fields', async () => {
            const response = await makeRemoveProgramsFromClassesMutation(
                [{}],
                adminUser
            )

            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(2)
            expect(response.body.errors[0].message).to.contain(
                'Field "classId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "programIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('addStudentsToClasses', () => {
        let adminUser: User
        let input: AddStudentsToClassInput[]
        let classes: Class[]

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const org = await createOrganization().save()
            const students = createUsers(2)
            await connection.manager.save(students)
            for (let x = 0; x < students.length; x++) {
                // eslint-disable-next-line no-await-in-loop
                await createOrganizationMembership({
                    user: students[x],
                    organization: org,
                    roles: [],
                }).save()
            }
            classes = createClasses(2, org)
            await connection.manager.save(classes)
            input = []
            for (const class_ of classes) {
                input.push({
                    classId: class_.class_id,
                    studentIds: students.map((st) => st.user_id),
                })
            }
        })
        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                print(ADD_STUDENTS_TO_CLASSES),
                { input },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(200)
            const resClasses: ClassConnectionNode[] =
                response.body.data.addStudentsToClasses.classes
            expect(resClasses).to.have.length(classes.length)
        })
        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                print(ADD_STUDENTS_TO_CLASSES),
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(2)
            expect(response.body.errors[0].message).to.contain(
                'Field "classId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "studentIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('removeStudentsFromClasses', () => {
        let adminUser: User
        let input: RemoveStudentsFromClassInput[]
        let classes: Class[]

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const org = await createOrganization().save()
            const students = createUsers(2)
            await connection.manager.save(students)
            for (let x = 0; x < students.length; x++) {
                // eslint-disable-next-line no-await-in-loop
                await createOrganizationMembership({
                    user: students[x],
                    organization: org,
                    roles: [],
                }).save()
            }
            classes = createClasses(2, org)
            await connection.manager.save(classes)
            classes[0].students = Promise.resolve([students[0], students[1]])
            classes[1].students = Promise.resolve([students[0], students[1]])
            await connection.manager.save(classes)
            input = []
            for (const class_ of classes) {
                input.push({
                    classId: class_.class_id,
                    studentIds: students.map((st) => st.user_id),
                })
            }
        })
        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                print(REMOVE_STUDENTS_FROM_CLASSES),
                { input },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(200)
            const resClasses: ClassConnectionNode[] =
                response.body.data.removeStudentsFromClasses.classes
            expect(resClasses).to.have.length(classes.length)
        })
        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                print(REMOVE_STUDENTS_FROM_CLASSES),
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(2)
            expect(response.body.errors[0].message).to.contain(
                'Field "classId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "studentIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('addTeachersToClasses', () => {
        let adminUser: User
        let input: AddTeachersToClassInput[]
        let classes: Class[]

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const org = await createOrganization().save()
            const teachers = createUsers(2)
            await connection.manager.save(teachers)
            await OrganizationMembership.save(
                Array.from(teachers, (teacher) =>
                    createOrganizationMembership({
                        user: teacher,
                        organization: org,
                        roles: [],
                    })
                )
            )
            classes = createClasses(2, org)
            await connection.manager.save(classes)
            input = []
            for (const class_ of classes) {
                input.push({
                    classId: class_.class_id,
                    teacherIds: teachers.map((st) => st.user_id),
                })
            }
        })
        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                print(ADD_TEACHERS_TO_CLASSES),
                { input },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(200)
            const resClasses: ClassConnectionNode[] =
                response.body.data.addTeachersToClasses.classes
            expect(resClasses).to.have.length(classes.length)
        })
        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                print(ADD_TEACHERS_TO_CLASSES),
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(2)
            expect(response.body.errors[0].message).to.contain(
                'Field "classId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "teacherIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('removeTeachersFromClasses', () => {
        let adminUser: User
        let input: RemoveTeachersFromClassInput[]
        let classes: Class[]

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const org = await createOrganization().save()
            const teachers = await User.save(createUsers(3))
            await OrganizationMembership.save(
                Array.from(teachers, (teacher) =>
                    createOrganizationMembership({
                        user: teacher,
                        organization: org,
                        roles: [],
                    })
                )
            )
            classes = await Class.save(createClasses(2, org))
            classes[0].teachers = Promise.resolve(teachers)
            classes[1].teachers = Promise.resolve(teachers)
            await connection.manager.save(classes)
            input = []
            for (const class_ of classes) {
                input.push({
                    classId: class_.class_id,
                    teacherIds: teachers.map((st) => st.user_id),
                })
            }
        })
        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                print(REMOVE_TEACHERS_FROM_CLASSES),
                { input },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(200)
            const resClasses: ClassConnectionNode[] =
                response.body.data.removeTeachersFromClasses.classes
            expect(resClasses).to.have.length(classes.length)
        })
        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                print(REMOVE_TEACHERS_FROM_CLASSES),
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(2)
            expect(response.body.errors[0].message).to.contain(
                'Field "classId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "teacherIds" of required type "[ID!]!" was not provided.'
            )
        })
    })

    context('setAcademicTermsOfClasses', () => {
        let adminUser: User
        let input: SetAcademicTermOfClassInput[]
        let school: School
        let classes: Class[]
        let terms: AcademicTerm[]

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const org = await createOrganization().save()
            school = await createSchoolFactory(org).save()
            classes = await Class.save([
                createClassFactory([school], org),
                createClassFactory([school], org),
                createClassFactory([school], org),
            ])
            terms = await AcademicTerm.save(
                createSuccessiveAcademicTerms(2, school)
            )
            classes[2].academicTerm = Promise.resolve(terms[0])
            await connection.manager.save(classes)

            input = [
                { classId: classes[0].class_id, academicTermId: terms[0].id },
                { classId: classes[1].class_id, academicTermId: terms[1].id },
                { classId: classes[2].class_id, academicTermId: null },
            ]
        })

        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                print(SET_ACADEMIC_TERMS_OF_CLASSES),
                { input },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(200)
            const resClasses: ClassConnectionNode[] =
                response.body.data.setAcademicTermsOfClasses.classes
            expect(resClasses).to.have.length(classes.length)
        })

        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                print(SET_ACADEMIC_TERMS_OF_CLASSES),
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "classId" of required type "ID!" was not provided.'
            )
        })
    })
    context('MoveTeachersToClass', () => {
        let org: Organization
        let teachers: User[]
        let classes: Class[]
        let schools: School[]
        let nonAdminUser: User
        beforeEach(async () => {
            const users = createUsers(1)
            nonAdminUser = await User.save(users[0])
            org = await createOrganization().save()

            const permissions = [
                PermissionName.delete_teacher_from_class_20446,
                PermissionName.add_teachers_to_class_20226,
                PermissionName.move_teachers_to_another_class_20336,
            ]
            const nonAdminRole = await createRoleFactory(
                'Non Admin Role',
                org,
                { permissions: permissions }
            ).save()
            await createOrganizationMembership({
                user: nonAdminUser,
                organization: org,
                roles: [nonAdminRole],
            }).save()
            teachers = await User.save(createUsers(3))
            classes = createClasses(2, org)
            schools = await School.save(createSchools(1, org))
            classes[0].teachers = Promise.resolve([teachers[0], teachers[1]])
            classes[1].teachers = Promise.resolve([teachers[2]])
            classes[0].schools = Promise.resolve([schools[0]])
            classes[1].schools = Promise.resolve([schools[0]])
            await Class.save(classes)
            await OrganizationMembership.save(
                Array.from(teachers, (teacher) =>
                    createOrganizationMembership({
                        user: teacher,
                        organization: org,
                        roles: [],
                    })
                )
            )
            await SchoolMembership.save(
                Array.from(teachers, (teacher) =>
                    createSchoolMembership({
                        user: teacher,
                        school: schools[0],
                    })
                )
            )
        })
        it('succeeds in moving teachers', async () => {
            const input: MoveUsersToClassInput = {
                fromClassId: classes[0].class_id,
                toClassId: classes[1].class_id,
                userIds: [teachers[0].user_id, teachers[1].user_id],
            }
            const checkteachers = teachers || []
            const checkIds = checkteachers.map((u) => u.user_id)
            const response = await makeRequest(
                request,
                print(MOVE_TEACHERS_TO_CLASS),
                { input },
                generateToken(userToPayload(nonAdminUser))
            )
            expect(response.status).to.eq(200)
            expect(
                response.body.data.moveTeachersToClass.fromClass.id
            ).to.equal(classes[0].class_id)
            expect(response.body.data.moveTeachersToClass.toClass.id).to.equal(
                classes[1].class_id
            )
            const dbClassFrom = await Class.findOne({
                where: { class_id: classes[0].class_id },
            })
            expect(dbClassFrom).to.exist
            const dbClassTo = await Class.findOne({
                where: { class_id: classes[1].class_id },
            })
            expect(dbClassTo).to.exist
            const teachersFrom = (await dbClassFrom!.teachers) || []
            const teachersTo = (await dbClassTo!.teachers) || []
            const teachersToIds = teachersTo.map((u) => u.user_id)
            expect(teachersFrom.length).to.equal(0)
            expect(teachersToIds).to.deep.equalInAnyOrder(checkIds)
        })
    })
    context('MoveStudentsToClass', () => {
        let org: Organization
        let students: User[]
        let classes: Class[]
        let schools: School[]
        let nonAdminUser: User
        beforeEach(async () => {
            const users = createUsers(1)
            nonAdminUser = await User.save(users[0])
            org = await createOrganization().save()

            const permissions = [
                PermissionName.add_students_to_class_20225,
                PermissionName.delete_student_from_class_roster_20445,
                PermissionName.move_students_to_another_class_20335,
            ]
            const nonAdminRole = await createRoleFactory(
                'Non Admin Role',
                org,
                { permissions: permissions }
            ).save()
            await createOrganizationMembership({
                user: nonAdminUser,
                organization: org,
                roles: [nonAdminRole],
            }).save()
            students = await User.save(createUsers(3))
            classes = createClasses(2, org)
            schools = await School.save(createSchools(1, org))
            classes[0].students = Promise.resolve([students[0], students[1]])
            classes[1].students = Promise.resolve([students[2]])
            classes[0].schools = Promise.resolve([schools[0]])
            classes[1].schools = Promise.resolve([schools[0]])
            await Class.save(classes)
            await OrganizationMembership.save(
                Array.from(students, (student) =>
                    createOrganizationMembership({
                        user: student,
                        organization: org,
                        roles: [],
                    })
                )
            )
            await SchoolMembership.save(
                Array.from(students, (student) =>
                    createSchoolMembership({
                        user: student,
                        school: schools[0],
                    })
                )
            )
        })
        it('succeeds in moving students', async () => {
            const input: MoveUsersToClassInput = {
                fromClassId: classes[0].class_id,
                toClassId: classes[1].class_id,
                userIds: [students[0].user_id, students[1].user_id],
            }
            const checkstudents = students || []
            const checkIds = checkstudents.map((u) => u.user_id)
            const response = await makeRequest(
                request,
                print(MOVE_STUDENTS_TO_CLASS),
                { input },
                generateToken(userToPayload(nonAdminUser))
            )
            expect(response.status).to.eq(200)
            expect(
                response.body.data.moveStudentsToClass.fromClass.id
            ).to.equal(classes[0].class_id)
            expect(response.body.data.moveStudentsToClass.toClass.id).to.equal(
                classes[1].class_id
            )
            const dbClassFrom = await Class.findOne({
                where: { class_id: classes[0].class_id },
            })
            expect(dbClassFrom).to.exist
            const dbClassTo = await Class.findOne({
                where: { class_id: classes[1].class_id },
            })
            expect(dbClassTo).to.exist
            const studentsFrom = (await dbClassFrom!.students) || []
            const studentsTo = (await dbClassTo!.students) || []
            const studentsToIds = studentsTo.map((u) => u.user_id)
            expect(studentsFrom.length).to.equal(0)
            expect(studentsToIds).to.deep.equalInAnyOrder(checkIds)
        })
    })
})
