import { expect, use } from 'chai'
import { print } from 'graphql'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Class } from '../../src/entities/class'
import { Organization } from '../../src/entities/organization'
import { Program } from '../../src/entities/program'
import { School } from '../../src/entities/school'
import { User } from '../../src/entities/user'
import { PermissionName } from '../../src/permissions/permissionNames'
import {
    AddClassesToSchoolInput,
    CreateSchoolInput,
    ISchoolsConnectionNode,
    UpdateSchoolInput,
} from '../../src/types/graphQL/school'
import { createClass } from '../factories/class.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createSchool as createFactorySchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createUser } from '../factories/user.factory'
import { NIL_UUID } from '../utils/database'
import { loadFixtures } from '../utils/fixtures'
import {
    createOrg,
    createSchool,
} from '../utils/operations/acceptance/acceptanceOps.test'
import {
    SCHOOLS_CONNECTION,
    SCHOOLS_CONNECTION_WITH_CHILDREN,
    SCHOOL_NODE,
} from '../utils/operations/modelOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { makeRequest } from './utils'
import ProgramsInitializer from '../../src/initializers/programs'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { DeleteSchoolInput } from '../../src/types/graphQL/school'
import {
    CREATE_SCHOOLS,
    DELETE_SCHOOLS,
    UPDATE_SCHOOLS,
} from '../utils/operations/schoolOps'
import { Status } from '../../src/entities/status'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { userToPayload } from '../utils/operations/userOps'
import { ADD_CLASSES_TO_SCHOOLS } from '../utils/operations/schoolOps'

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'

async function makeConnectionQuery() {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: SCHOOLS_CONNECTION,
            variables: {
                direction: 'FORWARD',
            },
        })
}

const makeNodeQuery = async (id: string) => {
    return await request
        .post('/user')
        .set({
            ContentType: 'application/json',
            Authorization: getAdminAuthToken(),
        })
        .send({
            query: print(SCHOOL_NODE),
            variables: {
                id,
            },
        })
}

use(deepEqualInAnyOrder)

describe('acceptance.school', () => {
    let connection: Connection
    let schoolId: string
    let clientUser: User
    let schoolMember: User
    let organizationId: string

    before(async () => {
        connection = await createTestConnection()
    })

    beforeEach(async () => {
        await loadFixtures('users', connection)
        // find the NON admin user created above...
        // TODO this whole thing better...
        clientUser = (await User.findOne(
            'c6d4feed-9133-5529-8d72-1003526d1b13'
        )) as User
        const createOrgResponse = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )
        organizationId =
            createOrgResponse.body.data.user.createOrganization.organization_id
        const createSchoolResponse = await createSchool(
            organizationId,
            `school x`,
            getAdminAuthToken()
        )
        schoolId =
            createSchoolResponse.body.data.organization.createSchool.school_id
        const school = await School.findOne(schoolId)

        schoolMember = await createUser().save()
        await createSchoolMembership({
            school: school!,
            user: schoolMember,
        }).save()
        await createSchoolMembership({
            school: school!,
            user: clientUser!,
        }).save()
    })

    after(async () => {
        await connection?.close()
    })

    context('schoolsConnection', () => {
        let schoolsCount: number
        let wizardingSchool: School
        let wizardOrg: Organization
        let potionsClass: Class
        let wizardUser: User

        beforeEach(async () => {
            schoolsCount = await School.count()
        })

        context('when data is requested in a correct way', () => {
            it('should response with status 200', async () => {
                const response = await makeConnectionQuery()
                const schoolsConnection = response.body.data.schoolsConnection

                expect(response.status).to.eq(200)
                expect(schoolsConnection.totalCount).to.equal(schoolsCount)
            })
        })

        context('when data is requested in an incorrect way', () => {
            it('should response with status 400', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: SCHOOLS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            filterArgs: {
                                byStatus: {
                                    operator: 'eq',
                                    value: 'available',
                                },
                            },
                        },
                    })

                const errors = response.body.errors
                const data = response.body.data

                expect(response.status).to.eq(400)
                expect(errors).to.exist
                expect(data).to.be.undefined
            })
        })

        it('has classesConnection as a child', async () => {
            const query = `
                query schoolsConnection($direction: ConnectionDirection!) {
                    schoolsConnection(direction:$direction){
                        edges {
                            node {
                                classesConnection{
                                    edges{
                                        node{
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`

            wizardUser = await createUser().save()
            wizardOrg = await createOrganization().save()
            wizardingSchool = await createFactorySchool(
                wizardOrg,
                'Hogwarts'
            ).save()
            potionsClass = await createClass(
                [wizardingSchool],
                wizardOrg
            ).save()
            const role = await createRole(undefined, undefined, {
                permissions: [
                    PermissionName.view_school_20110,
                    PermissionName.view_school_classes_20117,
                ],
            }).save()

            await createOrganizationMembership({
                user: wizardUser,
                organization: wizardOrg,
                roles: [role],
            }).save()
            await createSchoolMembership({
                user: wizardUser,
                school: wizardingSchool,
            }).save()

            const token = generateToken({
                id: wizardUser.user_id,
                email: wizardUser.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                },
                token
            )

            expect(response.status).to.eq(200)
            expect(
                response.body.data.schoolsConnection.edges[0].node
                    .classesConnection.edges[0].node.id
            ).to.eq(potionsClass.class_id)
        })

        it('has programsConnection as a child', async () => {
            await ProgramsInitializer.run()
            const systemPrograms = await Program.find({
                where: { system: true },
                take: 3,
            })
            const systemProgramIds = systemPrograms.map((p) => p.id)

            const school = await School.findOneOrFail(schoolId)
            school.programs = Promise.resolve(systemPrograms)
            await school.save()

            const response = await makeRequest(
                request,
                print(SCHOOLS_CONNECTION_WITH_CHILDREN),
                { direction: 'FORWARD' },
                generateToken({
                    id: clientUser.user_id,
                    email: clientUser.email,
                    iss: 'calmid-debug',
                })
            )

            expect(response.status).to.eq(200)

            const schoolsConnection = response.body.data.schoolsConnection
            expect(schoolsConnection.edges).to.have.lengthOf(schoolsCount)
            schoolsConnection.edges.forEach(
                (s: { node: ISchoolsConnectionNode }) => {
                    const programsConnection = s.node.programsConnection
                    expect(programsConnection?.edges).to.have.lengthOf(
                        systemPrograms.length
                    )

                    const programIds = programsConnection?.edges.map(
                        (p) => p.node.id
                    )

                    expect(programIds).to.deep.equalInAnyOrder(systemProgramIds)
                }
            )
        })
    })

    context('schoolNode', () => {
        context('when requested school exists', () => {
            it('should respond succesfully', async () => {
                const schoolResponse = await makeConnectionQuery()
                const schoolsEdges =
                    schoolResponse.body.data.schoolsConnection.edges
                const schoolId = schoolsEdges[0].node.id
                const response = await makeNodeQuery(schoolId)
                const schoolNode = response.body.data.schoolNode

                expect(response.status).to.eq(200)
                expect(schoolNode.id).to.equal(schoolId)
            })
        })

        context('when requested school does not exists', () => {
            it('should respond with errors', async () => {
                const response = await makeNodeQuery(NIL_UUID)
                const errors = response.body.errors
                const schoolNode = response.body.data.schoolNode

                expect(response.status).to.eq(200)
                expect(errors).to.exist
                expect(schoolNode).to.be.null
            })
        })

        it('has schoolMembershipsConnection as a child', async () => {
            const response = await makeNodeQuery(schoolId)
            const schoolNode = response.body.data
                .schoolNode as ISchoolsConnectionNode

            expect(response.status).to.eq(200)
            const memberships = schoolNode.schoolMembershipsConnection?.edges.map(
                (e) => e.node.userId
            )
            expect(memberships).to.have.members([
                schoolMember.user_id,
                clientUser.user_id,
            ])
        })
    })

    context('deleteSchools', () => {
        const makeDeleteSchoolsMutation = async (
            input: DeleteSchoolInput[]
        ) => {
            return await makeRequest(
                request,
                print(DELETE_SCHOOLS),
                { input },
                getAdminAuthToken()
            )
        }

        context('when input is sent in a correct way', () => {
            it('should respond succesfully', async () => {
                const input = [{ id: schoolId }]

                const response = await makeDeleteSchoolsMutation(input)
                const schools = response.body.data.deleteSchools.schools
                expect(response.status).to.eq(200)
                expect(schools).to.exist
                expect(schools).to.be.an('array')
                expect(schools.length).to.eq(input.length)
                const schoolDeletedIds = schools.map(
                    (cd: ISchoolsConnectionNode) => cd.id
                )

                const inputIds = input.map((i) => i.id)

                expect(schoolDeletedIds).to.deep.equalInAnyOrder(inputIds)
            })
        })

        context('when input is sent in an incorrect way', () => {
            it('should respond with errors', async () => {
                const input = [{ id: schoolId }, { id: NIL_UUID }]

                const response = await makeDeleteSchoolsMutation(input)
                const schoolsDeleted = response.body.data.deleteSchools
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(schoolsDeleted).to.be.null
                expect(errors).to.exist
            })
        })
    })
    context('addClassesToSchools', () => {
        let adminUser: User
        let input: AddClassesToSchoolInput[]
        const classesCount = 20
        const schoolsCount = 50
        const classes: Class[] = []

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            for (let x = 0; x < classesCount; x++) {
                const cls = await createClass().save()
                classes.push(cls)
            }

            const schools = []
            for (let i = 0; i < schoolsCount; i++) {
                schools.push(await createFactorySchool().save())
            }

            input = []
            for (let i = 0; i < schoolsCount; i++) {
                input.push({
                    schoolId: schools[i].school_id,
                    classIds: classes.slice(8, 15).map((v) => v.class_id),
                })
            }
        })

        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: generateToken(userToPayload(adminUser)),
                    })
                    .send({
                        query: ADD_CLASSES_TO_SCHOOLS,
                        variables: {
                            input,
                        },
                    })
                const resSchools =
                    response.body.data.addClassesToSchools.schools
                expect(response.status).to.eq(200)
                expect(resSchools.length).to.equal(schoolsCount)
            })
        })
    })

    context('createSchools', () => {
        const makeCreateSchoolsMutation = async (
            input: CreateSchoolInput[]
        ) => {
            return await makeRequest(
                request,
                print(CREATE_SCHOOLS),
                { input },
                getAdminAuthToken()
            )
        }

        context('when input is sent in a correct way', () => {
            it('should respond succesfully', async () => {
                const input = [
                    { organizationId, name: 'Test x' },
                    { organizationId, name: 'Test y' },
                ]

                const response = await makeCreateSchoolsMutation(input)
                const schools = response.body.data.createSchools.schools
                expect(response.status).to.eq(200)
                expect(schools).to.exist
                expect(schools).to.be.an('array')
                expect(schools.length).to.eq(input.length)
                const schoolCreatedNames = schools.map(
                    (schoolNode: ISchoolsConnectionNode) => schoolNode.name
                )

                const inputNames = input.map((i) => i.name)

                expect(schoolCreatedNames).to.deep.equalInAnyOrder(inputNames)
            })
        })

        context('when input is sent in an incorrect way', () => {
            it('should respond with errors', async () => {
                const input = [
                    { organizationId: NIL_UUID, name: 'Test x' },
                    { organizationId, name: 'Test y' },
                ]
                const response = await makeCreateSchoolsMutation(input)
                const schoolsCreated = response.body.data.createSchools
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(schoolsCreated).to.be.null
                expect(errors).to.exist
            })
        })
    })
    context('updateSchools', () => {
        let input: UpdateSchoolInput[]

        beforeEach(async () => {
            const school = await School.findOne(schoolId)
            input = [
                {
                    organizationId: (await school?.organization)
                        ?.organization_id as string,
                    name: school?.school_name as string,
                    id: school?.school_id as string,
                    shortCode: school?.shortcode as string,
                },
            ]
        })

        const makeUpdateSchoolsMutation = async (
            input: UpdateSchoolInput[]
        ) => {
            return await makeRequest(
                request,
                print(UPDATE_SCHOOLS),
                { input },
                getAdminAuthToken()
            )
        }

        context('when input is sent in a correct way', () => {
            it('should respond succesfully', async () => {
                const response = await makeUpdateSchoolsMutation(input)
                const schools = response.body.data.updateSchools.schools
                expect(response.status).to.eq(200)
                expect(schools).to.exist
                expect(schools).to.be.an('array')
                expect(schools.length).to.eq(input.length)
                const schoolUpdatedIds = schools.map(
                    (cd: ISchoolsConnectionNode) => cd.id
                )

                const inputIds = input.map((i) => i.id)

                expect(schoolUpdatedIds).to.deep.equalInAnyOrder(inputIds)
            })
        })

        context('when input is sent in an incorrect way', () => {
            it('should respond with errors', async () => {
                const badInput = [
                    input[0],
                    {
                        id: NIL_UUID,
                        name: 'test',
                        organizationId: 'test',
                        shortCode: 'test',
                    },
                ]

                const response = await makeUpdateSchoolsMutation(badInput)
                const schoolsUpdated = response.body.data.updateSchools
                const errors = response.body.errors

                expect(response.status).to.eq(200)
                expect(schoolsUpdated).to.be.null
                expect(errors).to.exist
            })
        })
    })
})
