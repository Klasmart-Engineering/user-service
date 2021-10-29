import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import { Class } from '../../src/entities/class'
import { Status } from '../../src/entities/status'
import { User } from '../../src/entities/user'
import { AgeRangeConnectionNode } from '../../src/types/graphQL/ageRange'
import { ClassConnectionNode } from '../../src/types/graphQL/class'
import { GradeSummaryNode } from '../../src/types/graphQL/grade'
import { ProgramSummaryNode } from '../../src/types/graphQL/program'
import { SchoolSimplifiedSummaryNode } from '../../src/types/graphQL/school'
import { SubjectSummaryNode } from '../../src/types/graphQL/subject'
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
import { DELETE_CLASS } from '../utils/operations/classOps'
import { CLASSES_CONNECTION } from '../utils/operations/modelOps'
import {
    CREATE_CLASS,
    getSystemRoleIds,
} from '../utils/operations/organizationOps'
import { CREATE_ORGANIZATION, userToPayload } from '../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

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
let orgMember: User
let org1Id: string
let org2Id: string
let class1Ids: string[]
let class2Ids: string[]

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

async function createOrg(user_id: string, org_name: string, token: string) {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: CREATE_ORGANIZATION,
            variables: {
                user_id,
                org_name,
            },
        })
}

async function createClass(
    organization_id: string,
    class_name: string,
    token: string
) {
    return await request
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
    return await request
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
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        const systemRoles = await getSystemRoleIds()
        const schoolAdminRoleId = String(systemRoles['School Admin'])

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
            [schoolIds[0]]
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
        await addProgramsToClass(class1Ids[5], [programId], getAdminAuthToken())
    })

    context('classesConnection', () => {
        context('using explict count', async () => {
            async function makeQuery(pageSize: any) {
                return await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: CLASSES_CONNECTION,
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
                const pageSize = 'not_a_number'

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(400)
                expect(response.body.errors.length).to.equal(1)
                const message = response.body.errors[0].message
                expect(message)
                    .to.be.a('string')
                    .and.satisfy((msg: string) =>
                        msg.startsWith(
                            'Variable "$directionArgs" got invalid value "not_a_number" at "directionArgs.count"; Expected type "PageSize".'
                        )
                    )
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
            const organizationId = org2Id

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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

            classSchools.every((schools: SchoolSimplifiedSummaryNode[]) => {
                const schoolIds = schools.map((school) => school.id)
                expect(schoolIds).includes(schoolId)
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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

            classSubjects.every((subjects: SubjectSummaryNode[]) => {
                const subjectIds = subjects.map((subject) => subject.id)
                expect(subjectIds).includes(subjectId)
            })
        })

        it('queries paginated classes filtering by program ID', async () => {
            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CLASSES_CONNECTION,
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

            classPrograms.every((programs: ProgramSummaryNode[]) => {
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
                    query: CLASSES_CONNECTION,
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

        it("returns just the classes that belongs to user's school", async () => {
            const organizationId = org1Id

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(schoolAdmin)),
                })
                .send({
                    query: CLASSES_CONNECTION,
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

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(
                classesCount / schoolsCount
            )
        })

        it('returns empty classes if the user has not permissions', async () => {
            const organizationId = org1Id

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(orgMember)),
                })
                .send({
                    query: CLASSES_CONNECTION,
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

            const classesConnection = response.body.data.classesConnection

            expect(response.status).to.eq(200)
            expect(classesConnection.totalCount).to.equal(0)
        })

        it('returns empty classes if the user is not owner of the organization', async () => {
            const organizationId = org1Id

            const response = await request
                .post('/user')
                .set({
                    ContentType: 'application/json',
                    Authorization: generateToken(userToPayload(user2)),
                })
                .send({
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
                    query: CLASSES_CONNECTION,
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
    })
})
