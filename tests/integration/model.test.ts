import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { createTestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { createAgeRange } from '../factories/ageRange.factory'
import { createGrade } from '../factories/grade.factory'
import { createOrganization } from '../factories/organization.factory'
import { createRole } from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createSubcategory } from '../factories/subcategory.factory'
import { createUser } from '../factories/user.factory'
import {
    getAgeRange,
    getGrade,
    getSubcategory,
    getAllOrganizations,
    getOrganizations,
    me,
    myUsers,
    getProgram,
    permissionsConnection,
    uploadSchoolsFile,
    userConnection,
} from '../utils/operations/modelOps'
import {
    getAdminAuthToken,
    getAdminAuthWithoutIdToken,
    getNonAdminAuthToken,
} from '../utils/testConfig'
import {
    createOrganizationAndValidate,
    addOrganizationToUserAndValidate,
    addSchoolToUser,
} from '../utils/operations/userOps'
import { addUserToOrganizationAndValidate } from '../utils/operations/organizationOps'
import { Model } from '../../src/model'
import { AgeRange } from '../../src/entities/ageRange'
import { Grade } from '../../src/entities/grade'
import { User } from '../../src/entities/user'
import { Permission } from '../../src/entities/permission'
import { Organization } from '../../src/entities/organization'
import { Subcategory } from '../../src/entities/subcategory'
import chaiAsPromised from 'chai-as-promised'
import { Program } from '../../src/entities/program'
import { createProgram } from '../factories/program.factory'
import { Role } from '../../src/entities/role'
import { before } from 'mocha'
import { School } from '../../src/entities/school'
import RolesInitializer from '../../src/initializers/roles'
import {
    renameDuplicateOrganizationsMutation,
    renameDuplicateOrganizationsQuery,
} from '../utils/operations/renameDuplicateOrganizations'
import { IEntityFilter } from '../../src/utils/pagination/filtering'
import { addRoleToOrganizationMembership } from '../utils/operations/organizationMembershipOps'
import { addRoleToSchoolMembership } from '../utils/operations/schoolMembershipOps'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Status } from '../../src/entities/status'
import { PermissionName } from '../../src/permissions/permissionNames'
import { grantPermission } from '../utils/operations/roleOps'
import { Subject } from '../../src/entities/subject'
import {
    renameDuplicateSubjectsQuery,
    renameDuplicateSubjectsMutation,
} from '../utils/operations/renameDuplicateSubjects'
import {
    renameDuplicateGradesMutation,
    renameDuplicateGradesQuery,
} from '../utils/operations/renameDuplicateGrades'
import { convertDataToCursor } from '../../src/utils/pagination/paginate'
import { Class } from '../../src/entities/class'
import { createClass } from '../factories/class.factory'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('model', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('getMyUser', () => {
        let user: User

        beforeEach(async () => {
            user = await createAdminUser(testClient)
        })
    })

    describe('myUsers', () => {
        let user: User
        let otherUser: User
        let org: Organization

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            otherUser = await createNonAdminUser(testClient)
            org = createOrganization()
            await connection.manager.save(org)
            await addOrganizationToUserAndValidate(
                testClient,
                user.user_id,
                org.organization_id,
                getAdminAuthToken()
            )

            await addOrganizationToUserAndValidate(
                testClient,
                otherUser.user_id,
                org.organization_id,
                getAdminAuthToken()
            )
        })

        context('when user is not logged in', () => {
            it('raises an error', async () => {
                const fn = () =>
                    myUsers(testClient, { authorization: undefined })

                expect(fn()).to.be.rejected
            })
        })

        context('when user is logged in', () => {
            const userInfo = (user: User) => {
                return user.user_id
            }

            it('returns the expected users', async () => {
                const gqlUsers = await myUsers(testClient, {
                    authorization: getAdminAuthToken(),
                })

                expect(gqlUsers.map(userInfo)).to.deep.eq([user.user_id])
            })
        })
        context('when usermembership is inactive', () => {
            beforeEach(async () => {
                const dbOtherMembership = await OrganizationMembership.findOneOrFail(
                    {
                        user_id: otherUser.user_id,
                        organization_id: org.organization_id,
                    }
                )
                if (dbOtherMembership) {
                    dbOtherMembership.status = Status.INACTIVE
                    await connection.manager.save(dbOtherMembership)
                }
            })

            it('returns no users', async () => {
                const fn = () =>
                    myUsers(testClient, {
                        authorization: getNonAdminAuthToken(),
                    })

                expect(fn()).to.be.rejected
            })
        })
    })

    describe('getOrganizations', () => {
        let user: User
        let organization: Organization

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
            )
        })

        context('when user is not logged in', () => {
            it('returns an empty list of organizations', async () => {
                const gqlOrgs = await getAllOrganizations(testClient, {
                    authorization: undefined,
                })

                expect(gqlOrgs).to.be.empty
            })
        })

        context('when user is logged in', () => {
            const orgInfo = (org: Organization) => {
                return org.organization_id
            }
            let otherOrganization: Organization

            beforeEach(async () => {
                const otherUser = await createNonAdminUser(testClient)
                otherOrganization = await createOrganizationAndValidate(
                    testClient,
                    otherUser.user_id,
                    "Billy's Org"
                )
            })

            context('and the user is not an admin', () => {
                it('raises an error', async () => {
                    const fn = () =>
                        getAllOrganizations(testClient, {
                            authorization: getNonAdminAuthToken(),
                        })

                    expect(fn()).to.be.rejected
                })
            })

            context('and there is no filter in the organization ids', () => {
                it('returns the expected organizations', async () => {
                    const gqlOrgs = await getAllOrganizations(testClient, {
                        authorization: getAdminAuthToken(),
                    })

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([
                        organization.organization_id,
                        otherOrganization.organization_id,
                    ])
                })
            })

            context('and there is a filter in the organization ids', () => {
                it('returns the expected organizations', async () => {
                    const gqlOrgs = await getOrganizations(
                        testClient,
                        [organization.organization_id],
                        { authorization: getAdminAuthToken() }
                    )

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([
                        organization.organization_id,
                    ])
                })
            })
        })
    })

    describe('getAgeRange', () => {
        let user: User
        let ageRange: AgeRange
        let organizationId: string

        const ageRangeInfo = (ageRange: AgeRange) => {
            return {
                id: ageRange.id,
                name: ageRange.name,
                high_value: ageRange.high_value,
                high_value_unit: ageRange.high_value_unit,
                low_value: ageRange.low_value,
                low_value_unit: ageRange.low_value_unit,
                system: ageRange.system,
            }
        }

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            const org = createOrganization(user)
            await connection.manager.save(org)
            organizationId = org.organization_id
            ageRange = createAgeRange(org)
            await connection.manager.save(ageRange)
        })

        context('when user is not logged in', () => {
            it('returns no age range', async () => {
                const gqlAgeRange = await getAgeRange(testClient, ageRange.id, {
                    authorization: undefined,
                })

                expect(gqlAgeRange).to.be.null
            })
        })

        context('when user is logged in', () => {
            let otherUserId: string

            beforeEach(async () => {
                const otherUser = await createNonAdminUser(testClient)
                otherUserId = otherUser.user_id
            })

            context('and the user is not an admin', () => {
                context(
                    'and it belongs to the organization from the age range',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                otherUserId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected age range', async () => {
                            const gqlAgeRange = await getAgeRange(
                                testClient,
                                ageRange.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlAgeRange).not.to.be.null
                            expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(
                                ageRangeInfo(ageRange)
                            )
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the age range',
                    () => {
                        it('returns no age range', async () => {
                            const gqlAgeRange = await getAgeRange(
                                testClient,
                                ageRange.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlAgeRange).to.be.null
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and it belongs to the organization from the age range',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                user.user_id,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected age range', async () => {
                            const gqlAgeRange = await getAgeRange(
                                testClient,
                                ageRange.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlAgeRange).not.to.be.null
                            expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(
                                ageRangeInfo(ageRange)
                            )
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the age range',
                    () => {
                        it('returns the expected age range', async () => {
                            const gqlAgeRange = await getAgeRange(
                                testClient,
                                ageRange.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlAgeRange).not.to.be.null
                            expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(
                                ageRangeInfo(ageRange)
                            )
                        })
                    }
                )
            })
        })
    })

    describe('getGrade', () => {
        let user: User
        let userId: string
        let otherUserId: string
        let organization: Organization
        let organizationId: string
        let grade: Grade

        let gradeDetails: any

        const gradeInfo = async (grade: Grade) => {
            return {
                name: grade.name,
                progress_from_grade_id: (await grade.progress_from_grade)?.id,
                progress_to_grade_id: (await grade.progress_to_grade)?.id,
                system: grade.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            otherUserId = orgOwner.user_id
            user = await createNonAdminUser(testClient)
            userId = user.user_id
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            organizationId = organization.organization_id
            const progressFromGrade = createGrade(organization)
            await progressFromGrade.save()
            const progressToGrade = createGrade(organization)
            await progressToGrade.save()
            grade = createGrade(
                organization,
                progressFromGrade,
                progressToGrade
            )
            await grade.save()
            gradeDetails = await gradeInfo(grade)
        })

        context('when user is not logged in', () => {
            it('returns no age range', async () => {
                const gqlGrade = await getGrade(testClient, grade.id, {
                    authorization: undefined,
                })

                expect(gqlGrade).to.be.null
            })
        })

        context('when user is logged in', () => {
            context('and the user is not an admin', () => {
                context(
                    'and it belongs to the organization from the grade',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                userId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected grade', async () => {
                            const gqlGrade = await getGrade(
                                testClient,
                                grade.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlGrade).not.to.be.null
                            const gqlGradeDetails = await gradeInfo(gqlGrade)
                            expect(gqlGradeDetails).to.deep.eq(gradeDetails)
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the grade',
                    () => {
                        it('returns no grade', async () => {
                            const gqlGrade = await getGrade(
                                testClient,
                                grade.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlGrade).to.be.null
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and it belongs to the organization from the grade',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                otherUserId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected grade', async () => {
                            const gqlGrade = await getGrade(
                                testClient,
                                grade.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlGrade).not.to.be.null
                            const gqlGradeDetails = await gradeInfo(gqlGrade)
                            expect(gqlGradeDetails).to.deep.eq(gradeDetails)
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the grade',
                    () => {
                        it('returns the expected grade', async () => {
                            const gqlGrade = await getGrade(
                                testClient,
                                grade.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlGrade).not.to.be.null
                            const gqlGradeDetails = await gradeInfo(gqlGrade)
                            expect(gqlGradeDetails).to.deep.eq(gradeDetails)
                        })
                    }
                )
            })
        })
    })

    describe('getSubcategory', () => {
        let user: User
        let subcategory: Subcategory
        let organizationId: string

        const subcategoryInfo = (subcategory: Subcategory) => {
            return {
                id: subcategory.id,
                name: subcategory.name,
                system: subcategory.system,
            }
        }

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            const org = createOrganization(user)
            await connection.manager.save(org)
            organizationId = org.organization_id
            subcategory = createSubcategory(org)
            await connection.manager.save(subcategory)
        })

        context('when user is not logged in', () => {
            it('returns no subcategory', async () => {
                const gqlSubcategory = await getSubcategory(
                    testClient,
                    subcategory.id,
                    { authorization: undefined }
                )

                expect(gqlSubcategory).to.be.null
            })
        })

        context('when user is logged in', () => {
            let otherUserId: string

            beforeEach(async () => {
                const otherUser = await createNonAdminUser(testClient)
                otherUserId = otherUser.user_id
            })

            context('and the user is not an admin', () => {
                context(
                    'and it belongs to the organization from the subcategory',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                otherUserId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected subcategory', async () => {
                            const gqlSubcategory = await getSubcategory(
                                testClient,
                                subcategory.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlSubcategory).not.to.be.null
                            expect(subcategoryInfo(gqlSubcategory)).to.deep.eq(
                                subcategoryInfo(subcategory)
                            )
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the subcategory',
                    () => {
                        it('returns no subcategory', async () => {
                            const gqlSubcategory = await getSubcategory(
                                testClient,
                                subcategory.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlSubcategory).to.be.null
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and it belongs to the organization from the subcategory',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                user.user_id,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected subcategory', async () => {
                            const gqlSubcategory = await getSubcategory(
                                testClient,
                                subcategory.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlSubcategory).not.to.be.null
                            expect(subcategoryInfo(gqlSubcategory)).to.deep.eq(
                                subcategoryInfo(subcategory)
                            )
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the subcategory',
                    () => {
                        it('returns the expected subcategory', async () => {
                            const gqlSubcategory = await getSubcategory(
                                testClient,
                                subcategory.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlSubcategory).not.to.be.null
                            expect(subcategoryInfo(gqlSubcategory)).to.deep.eq(
                                subcategoryInfo(subcategory)
                            )
                        })
                    }
                )
            })
        })
    })
    describe('getProgram', () => {
        let user: User
        let program: Program
        let organizationId: string

        const programInfo = (program: Program) => {
            return {
                id: program.id,
                name: program.name,
                system: program.system,
            }
        }

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            const org = createOrganization(user)
            await connection.manager.save(org)
            organizationId = org.organization_id
            program = createProgram(org)
            await connection.manager.save(program)
        })

        context('when user is not logged in', () => {
            it('returns no program', async () => {
                const gqlProgram = await getProgram(testClient, program.id, {
                    authorization: undefined,
                })

                expect(gqlProgram).to.be.null
            })
        })

        context('when user is logged in', () => {
            let otherUserId: string

            beforeEach(async () => {
                const otherUser = await createNonAdminUser(testClient)
                otherUserId = otherUser.user_id
            })

            context('and the user is not an admin', () => {
                context(
                    'and it belongs to the organization from the program',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                otherUserId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected program', async () => {
                            const gqlProgram = await getProgram(
                                testClient,
                                program.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlProgram).not.to.be.null
                            expect(programInfo(gqlProgram)).to.deep.eq(
                                programInfo(program)
                            )
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the program',
                    () => {
                        it('returns no program', async () => {
                            const gqlProgram = await getProgram(
                                testClient,
                                program.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlProgram).to.be.null
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and it belongs to the organization from the program',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                user.user_id,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('returns the expected program', async () => {
                            const gqlProgram = await getProgram(
                                testClient,
                                program.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlProgram).not.to.be.null
                            expect(programInfo(gqlProgram)).to.deep.eq(
                                programInfo(program)
                            )
                        })
                    }
                )

                context(
                    'and it does not belongs to the organization from the program',
                    () => {
                        it('returns the expected program', async () => {
                            const gqlProgram = await getProgram(
                                testClient,
                                program.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlProgram).not.to.be.null
                            expect(programInfo(gqlProgram)).to.deep.eq(
                                programInfo(program)
                            )
                        })
                    }
                )
            })
        })
    })

    describe('usersConnection', () => {
        let usersList: User[] = []
        let roleList: Role[] = []
        const direction = 'FORWARD'
        let organizations: Organization[] = []

        beforeEach(async () => {
            usersList = []
            roleList = []
            const organizations: Organization[] = []
            const schools: School[] = []
            // create two orgs and two schools
            for (let i = 0; i < 2; i++) {
                const org = createOrganization()
                await connection.manager.save(org)
                organizations.push(org)
                let role = createRole('role ' + i, org)
                await connection.manager.save(role)
                roleList.push(role)
                const school = createSchool(org)
                await connection.manager.save(school)
                schools.push(school)
            }
            // create 10 users
            for (let i = 0; i < 10; i++) {
                usersList.push(createUser())
            }
            //sort users by userId
            await connection.manager.save(usersList)
            // add organizations and schools to users

            for (const user of usersList) {
                for (let i = 0; i < 2; i++) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        organizations[i].organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organizations[i].organization_id,
                        roleList[i].role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        user.user_id,
                        schools[i].school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        user.user_id,
                        schools[i].school_id,
                        roleList[i].role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
            }
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))
        })
        context('seek forward', () => {
            it('should get the next few records according to pagesize and startcursor', async () => {
                let directionArgs = {
                    count: 3,
                    cursor: convertDataToCursor({
                        user_id: usersList[3].user_id,
                    }),
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() }
                )

                expect(usersConnection?.totalCount).to.eql(10)
                expect(usersConnection?.edges.length).to.equal(3)
                for (let i = 0; i < 3; i++) {
                    expect(usersConnection?.edges[i].node.id).to.equal(
                        usersList[4 + i].user_id
                    )
                    expect(
                        usersConnection?.edges[i].node.organizations.length
                    ).to.equal(2)
                    expect(
                        usersConnection?.edges[i].node.schools.length
                    ).to.equal(2)
                    expect(
                        usersConnection?.edges[i].node.roles.length
                    ).to.equal(4)
                }
                expect(usersConnection?.pageInfo.startCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[4].user_id })
                )
                expect(usersConnection?.pageInfo.endCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[6].user_id })
                )
                expect(usersConnection?.pageInfo.hasNextPage).to.be.true
                expect(usersConnection?.pageInfo.hasPreviousPage).to.be.true
            })
        })

        context('organization filter', () => {
            let org: Organization
            let school1: School
            let role1: Role
            beforeEach(async () => {
                //org used to filter
                org = createOrganization()
                await connection.manager.save(org)
                role1 = createRole('role 1', org)
                await connection.manager.save(role1)
                school1 = createSchool(org)

                // org and school whose membership shouldnt be included
                let org2 = createOrganization()
                await connection.manager.save(org2)
                let role2 = createRole('role 2', org2)
                await connection.manager.save(role2)
                const school2 = createSchool(org2)

                await connection.manager.save(school1)
                await connection.manager.save(school2)

                usersList = []
                // create 10 users
                for (let i = 0; i < 10; i++) {
                    usersList.push(createUser())
                }
                //sort users by userId
                await connection.manager.save(usersList)
                for (const user of usersList) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        user.user_id,
                        school1.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        user.user_id,
                        school1.school_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )

                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org2.organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        org2.organization_id,
                        role2.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        user.user_id,
                        school2.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        user.user_id,
                        school2.school_id,
                        role2.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
                usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))
            })
            it('should filter the pagination results on organizationId', async () => {
                let directionArgs = {
                    count: 3,
                    cursor: convertDataToCursor({
                        user_id: usersList[3].user_id,
                    }),
                }
                const filter: IEntityFilter = {
                    organizationId: {
                        operator: 'eq',
                        value: org.organization_id,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(10)
                expect(usersConnection?.edges.length).to.equal(3)
                for (let i = 0; i < 3; i++) {
                    expect(usersConnection?.edges[i].node.id).to.equal(
                        usersList[4 + i].user_id
                    )
                    expect(
                        usersConnection?.edges[i].node.organizations.length
                    ).to.equal(1)
                    expect(
                        usersConnection?.edges[i].node.organizations[0].id
                    ).to.equal(org.organization_id)
                    expect(
                        usersConnection?.edges[i].node.schools.length
                    ).to.equal(1)
                    expect(
                        usersConnection?.edges[i].node.roles.length
                    ).to.equal(2)
                    expect(
                        usersConnection?.edges[i].node.schools[0].id
                    ).to.equal(school1.school_id)
                    expect(usersConnection?.edges[i].node.roles[0].id).to.equal(
                        role1.role_id
                    )
                }
                expect(usersConnection?.pageInfo.startCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[4].user_id })
                )
                expect(usersConnection?.pageInfo.endCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[6].user_id })
                )
                expect(usersConnection?.pageInfo.hasNextPage).to.be.true
                expect(usersConnection?.pageInfo.hasPreviousPage).to.be.true
            })

            it('returns roles if the user has no school memberships', async () => {
                const newUser = createUser()
                await connection.manager.save([newUser])

                await addOrganizationToUserAndValidate(
                    testClient,
                    newUser.user_id,
                    org.organization_id,
                    getAdminAuthToken()
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    newUser.user_id,
                    org.organization_id,
                    role1.role_id,
                    { authorization: getAdminAuthToken() }
                )

                const filter: IEntityFilter = {
                    organizationId: {
                        operator: 'eq',
                        value: org.organization_id,
                    },
                    userId: {
                        operator: 'eq',
                        value: newUser.user_id,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 1 },
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.edges[0].node.roles.length).to.equal(1)
            })
        })

        context('school filter', () => {
            let org: Organization
            let school1: School
            let school2: School
            let role1: Role
            beforeEach(async () => {
                //org used to filter
                const superAdmin = await createAdminUser(testClient)
                org = createOrganization(superAdmin)
                await connection.manager.save(org)
                role1 = createRole('role 1', org)
                await connection.manager.save(role1)
                school1 = createSchool(org)
                school2 = createSchool(org)

                await connection.manager.save(school1)
                await connection.manager.save(school2)

                usersList = []
                // create 10 users
                for (let i = 0; i < 10; i++) {
                    usersList.push(createUser())
                }
                //sort users by userId
                await connection.manager.save(usersList)
                usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

                for (const user of usersList) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }

                // add half of users to one school and other half to different school
                // also add 5th user to both school
                for (let i = 0; i <= 5; i++) {
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
                for (let i = 5; i < 10; i++) {
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school2.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
            })
            it('should filter the pagination results on schoolId', async () => {
                let directionArgs = {
                    count: 3,
                }
                const filter: IEntityFilter = {
                    schoolId: {
                        operator: 'eq',
                        value: school2.school_id,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(5)
                expect(usersConnection?.edges.length).to.equal(3)

                //user belonging to more than one returned
                expect(usersConnection?.edges[0].node.schools.length).to.equal(
                    1
                )
                expect(usersConnection?.edges[0].node.id).to.equal(
                    usersList[5].user_id
                )

                for (let i = 1; i < 3; i++) {
                    expect(usersConnection?.edges[i].node.id).to.equal(
                        usersList[5 + i].user_id
                    )
                    expect(
                        usersConnection?.edges[i].node.schools.length
                    ).to.equal(1)
                    expect(
                        usersConnection?.edges[i].node.schools[0].id
                    ).to.equal(school2.school_id)
                }
                expect(usersConnection?.pageInfo.startCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[5].user_id })
                )
                expect(usersConnection?.pageInfo.endCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[7].user_id })
                )
                expect(usersConnection?.pageInfo.hasNextPage).to.be.true
                expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
            })
            it('works for non-admins', async () => {
                const nonAdmin = await createNonAdminUser(testClient)
                await addOrganizationToUserAndValidate(
                    testClient,
                    nonAdmin.user_id,
                    org.organization_id,
                    getAdminAuthToken()
                )
                await grantPermission(
                    testClient,
                    role1.role_id,
                    PermissionName.view_users_40110,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    nonAdmin.user_id,
                    org.organization_id,
                    role1.role_id,
                    { authorization: getAdminAuthToken() }
                )
                const filter: IEntityFilter = {
                    schoolId: {
                        operator: 'eq',
                        value: school2.school_id,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: getNonAdminAuthToken() },
                    filter
                )
                expect(usersConnection?.totalCount).to.eql(5)
            })
        })

        context('role filter', () => {
            let org: Organization
            let school1: School
            let role1: Role
            let role2: Role
            beforeEach(async () => {
                //org used to filter
                org = createOrganization()
                await connection.manager.save(org)
                role1 = createRole('role 1', org)
                await connection.manager.save(role1)
                role2 = createRole('role 2', org)
                await connection.manager.save(role2)
                school1 = createSchool(org)
                await connection.manager.save(school1)

                usersList = []
                // create 10 users
                for (let i = 0; i < 10; i++) {
                    usersList.push(createUser())
                }
                //sort users by userId
                await connection.manager.save(usersList)
                usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

                for (const user of usersList) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                }

                // add 5 users to role1 and 5 users to role2
                // add 6th user to both roles
                for (let i = 0; i <= 5; i++) {
                    await addRoleToOrganizationMembership(
                        testClient,
                        usersList[i].user_id,
                        org.organization_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }

                for (let i = 5; i < usersList.length; i++) {
                    await addRoleToOrganizationMembership(
                        testClient,
                        usersList[i].user_id,
                        org.organization_id,
                        role2.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        role2.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
            })
            it('should filter the pagination results on roleId', async () => {
                let directionArgs = {
                    count: 3,
                }
                const filter: IEntityFilter = {
                    roleId: {
                        operator: 'eq',
                        value: role2.role_id,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(5)
                expect(usersConnection?.edges.length).to.equal(3)

                for (const e of usersConnection?.edges) {
                    expect(e.node.roles.length).to.equal(2)
                    for (const r of e.node.roles) {
                        expect(r.id).to.eq(role2.role_id)
                    }
                }

                for (let i = 0; i < 3; i++) {
                    expect(usersConnection?.edges[i].node.id).to.equal(
                        usersList[5 + i].user_id
                    )
                }
                expect(usersConnection?.pageInfo.startCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[5].user_id })
                )
                expect(usersConnection?.pageInfo.endCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[7].user_id })
                )
                expect(usersConnection?.pageInfo.hasNextPage).to.be.true
                expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
            })
        })

        context('organizationUserStatus filter', () => {
            let org: Organization
            let school1: School
            let role1: Role
            beforeEach(async () => {
                //org used to filter
                org = createOrganization()
                await connection.manager.save(org)
                role1 = createRole('role 1', org)
                await connection.manager.save(role1)
                school1 = createSchool(org)

                await connection.manager.save(school1)

                usersList = []
                // create 10 users
                for (let i = 0; i < 10; i++) {
                    usersList.push(createUser())
                }
                await connection.manager.save(usersList)
                //sort users by userId
                usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

                for (let i = 0; i < usersList.length; i++) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        usersList[i].user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        usersList[i].user_id,
                        org.organization_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }

                //set 4 users to inactive
                for (let i = 0; i < 4; i++) {
                    const membershipDb = await OrganizationMembership.findOneOrFail(
                        {
                            where: {
                                user_id: usersList[i].user_id,
                                organization_id: org.organization_id,
                            },
                        }
                    )
                    membershipDb.status = Status.INACTIVE
                    await connection.manager.save(membershipDb)
                }
            })

            it('should filter the pagination results on organizationId', async () => {
                let directionArgs = {
                    count: 3,
                }
                const filter: IEntityFilter = {
                    organizationId: {
                        operator: 'eq',
                        value: org.organization_id,
                    },
                    organizationUserStatus: {
                        operator: 'eq',
                        value: Status.INACTIVE,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(4)
                expect(usersConnection?.edges.length).to.equal(3)
                for (let i = 0; i < 3; i++) {
                    expect(
                        usersConnection?.edges[i].node.organizations[0]
                            .userStatus
                    ).to.equal(Status.INACTIVE)
                }
            })

            it('returns nothing for non admins', async () => {
                const filter: IEntityFilter = {
                    organizationId: {
                        operator: 'eq',
                        value: org.organization_id,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    undefined,
                    { authorization: getNonAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(0)
            })
        })

        context('filter combinations', () => {
            let org: Organization
            let org2: Organization
            let school1: School
            let school2: School
            let school3: School
            let role1: Role
            let role2: Role
            let role3: Role
            beforeEach(async () => {
                //org role and school used to filter
                org = createOrganization()
                await connection.manager.save(org)
                role1 = createRole('role 1', org)
                await connection.manager.save(role1)
                role2 = createRole('role 2', org)
                await connection.manager.save(role2)
                school1 = createSchool(org)
                await connection.manager.save(school1)
                school2 = createSchool(org)
                await connection.manager.save(school2)
                usersList = []
                // create 15 users
                for (let i = 0; i < 15; i++) {
                    usersList.push(createUser())
                }
                //sort users by userId
                await connection.manager.save(usersList)
                usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

                for (let i = 0; i < 10; i++) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        usersList[i].user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                }

                // add 5 users to role1/school1 and 5 users to role2/school2
                // add 6th user to both roles and schools
                for (let i = 0; i <= 5; i++) {
                    await addRoleToOrganizationMembership(
                        testClient,
                        usersList[i].user_id,
                        org.organization_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        usersList[i].user_id,
                        school1.school_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
                for (let i = 5; i < 10; i++) {
                    await addRoleToOrganizationMembership(
                        testClient,
                        usersList[i].user_id,
                        org.organization_id,
                        role2.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school2.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        usersList[i].user_id,
                        school2.school_id,
                        role2.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }

                // create second org and add other users to this org
                org2 = createOrganization()
                await connection.manager.save(org2)
                role3 = createRole('role 3', org2)
                await connection.manager.save(role3)
                school3 = createSchool(org2)
                await connection.manager.save(school3)

                for (let i = 10; i < 15; i++) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        usersList[i].user_id,
                        org2.organization_id,
                        getAdminAuthToken()
                    )
                }

                // add remaining users to school3 and role3
                for (let i = 10; i < 15; i++) {
                    await addRoleToOrganizationMembership(
                        testClient,
                        usersList[i].user_id,
                        org2.organization_id,
                        role3.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        usersList[i].user_id,
                        school3.school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        usersList[i].user_id,
                        school3.school_id,
                        role3.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
            })
            it('should filter the pagination results on all filters', async () => {
                let directionArgs = {
                    count: 3,
                }
                const filter: IEntityFilter = {
                    organizationId: {
                        operator: 'eq',
                        value: org.organization_id,
                    },
                    roleId: {
                        operator: 'eq',
                        value: role2.role_id,
                    },
                    schoolId: {
                        operator: 'eq',
                        value: school2.school_id,
                    },
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(5)
                expect(usersConnection?.edges.length).to.equal(3)

                for (let i = 0; i < 3; i++) {
                    expect(usersConnection?.edges[i].node.id).to.equal(
                        usersList[5 + i].user_id
                    )
                }
                expect(usersConnection?.pageInfo.startCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[5].user_id })
                )
                expect(usersConnection?.pageInfo.endCursor).to.equal(
                    convertDataToCursor({ user_id: usersList[7].user_id })
                )
                expect(usersConnection?.pageInfo.hasNextPage).to.be.true
                expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
            })
        })

        context('phoneFilter', () => {
            beforeEach(async () => {
                usersList = []
                roleList = []

                // create an org
                let org: Organization
                org = createOrganization()
                await connection.manager.save(org)

                // create 5 users
                for (let i = 0; i < 5; i++) {
                    usersList.push(createUser())
                }

                //sort users by userId
                await connection.manager.save(usersList)

                // add organizations and schools to users
                for (const user of usersList) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                }
                usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))
                // add phone number to 2 users
                usersList[0].phone = '123456789'
                usersList[1].phone = '456789123'
                await connection.manager.save(usersList[0])
                await connection.manager.save(usersList[1])
            })
            it('should filter on phone', async () => {
                const filter: IEntityFilter = {
                    phone: {
                        operator: 'contains',
                        caseInsensitive: true,
                        value: '123',
                    },
                }
                let directionArgs = {
                    count: 3,
                }
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(2)
                expect(usersConnection?.edges.length).to.equal(2)
                expect(usersConnection?.edges[0].node.id).to.equal(
                    usersList[0].user_id
                )
                expect(usersConnection?.edges[1].node.id).to.equal(
                    usersList[1].user_id
                )

                expect(usersConnection?.pageInfo.hasNextPage).to.be.false
                expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
            })
        })

        context('class filter', () => {
            let org: Organization
            let school: School
            let class1: Class
            let class2: Class
            let role1: Role

            beforeEach(async () => {
                //org used to filter
                const superAdmin = await createAdminUser(testClient)
                org = createOrganization(superAdmin)
                await connection.manager.save(org)
                role1 = createRole('role 1', org)
                await connection.manager.save(role1)
                school = createSchool(org)

                await connection.manager.save(school)

                class1 = createClass([school])
                class2 = createClass([school])

                await connection.manager.save(class1)
                await connection.manager.save(class2)

                usersList = []
                // create 10 users
                for (let i = 0; i < 10; i++) {
                    usersList.push(createUser())
                }
                //sort users by userId
                await connection.manager.save(usersList)
                usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

                for (const user of usersList) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )

                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        role1.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                }

                const class1Users = []
                const class2Users = []

                // add half of users to one class and other half to different class
                // also add 5th user to both classes
                for (let i = 0; i <= 5; i++) {
                    class1Users.push(usersList[i])
                }

                for (let i = 5; i < 10; i++) {
                    class2Users.push(usersList[i])
                }

                class1.students = Promise.resolve(class1Users)
                await class1.save()

                class2.students = Promise.resolve(class2Users)
                await class2.save()
            })

            it('should filter the pagination results on classId', async () => {
                let directionArgs = {
                    count: 5,
                }

                const filter: IEntityFilter = {
                    classId: {
                        operator: 'eq',
                        value: class2.class_id,
                    },
                }

                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    directionArgs,
                    { authorization: getAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(5)
                expect(usersConnection?.edges.length).to.equal(5)

                expect(usersConnection?.edges[0].node.id).to.equal(
                    usersList[5].user_id
                )

                for (let i = 1; i < 3; i++) {
                    expect(usersConnection?.edges[i].node.id).to.equal(
                        usersList[5 + i].user_id
                    )
                }

                const userIds = usersConnection?.edges.map((edge) => {
                    return edge.node.id
                })

                const DBClass = await connection.manager.findOne(Class, {
                    where: { class_id: class2.class_id },
                })

                const classUserIds =
                    (await DBClass?.students)?.map((student) => {
                        return student.user_id
                    }) || []

                expect(userIds).to.deep.equalInAnyOrder(classUserIds)
            })

            it('works for non-admins', async () => {
                const nonAdmin = await createNonAdminUser(testClient)
                await addOrganizationToUserAndValidate(
                    testClient,
                    nonAdmin.user_id,
                    org.organization_id,
                    getAdminAuthToken()
                )

                await grantPermission(
                    testClient,
                    role1.role_id,
                    PermissionName.view_users_40110,
                    { authorization: getAdminAuthToken() }
                )

                await addRoleToOrganizationMembership(
                    testClient,
                    nonAdmin.user_id,
                    org.organization_id,
                    role1.role_id,
                    { authorization: getAdminAuthToken() }
                )

                const filter: IEntityFilter = {
                    classId: {
                        operator: 'eq',
                        value: class2.class_id,
                    },
                }

                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 5 },
                    { authorization: getNonAdminAuthToken() },
                    filter
                )

                expect(usersConnection?.totalCount).to.eql(5)

                const userIds = usersConnection?.edges.map((edge) => {
                    return edge.node.id
                })

                const DBClass = await connection.manager.findOne(Class, {
                    where: { class_id: class2.class_id },
                })

                const classUserIds =
                    (await DBClass?.students)?.map((student) => {
                        return student.user_id
                    }) || []

                expect(userIds).to.deep.equalInAnyOrder(classUserIds)
            })
        })

        context('sorting', () => {
            it('sorts by givenName', async () => {
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: getAdminAuthToken() },
                    undefined,
                    {
                        field: 'givenName',
                        order: 'ASC',
                    }
                )

                const usersOrderedByGivenNameAsc = [...usersList].sort((a, b) =>
                    a.given_name!.localeCompare(b.given_name!)
                )

                for (let i = 0; i < usersConnection.edges.length; i++) {
                    expect(usersConnection.edges[i].node.givenName).to.eq(
                        usersOrderedByGivenNameAsc[i].given_name
                    )
                }
            })

            it('sorts by familyName', async () => {
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: getAdminAuthToken() },
                    undefined,
                    {
                        field: 'familyName',
                        order: 'DESC',
                    }
                )

                const usersOrderedByFamilyNameDesc = [
                    ...usersList,
                ].sort((a, b) => b.family_name!.localeCompare(a.family_name!))

                for (let i = 0; i < usersConnection.edges.length; i++) {
                    expect(usersConnection.edges[i].node.familyName).to.eq(
                        usersOrderedByFamilyNameDesc[i].family_name
                    )
                }
            })
            it('works with filtering', async () => {
                const usersOrderedByGivenNameAsc = [...usersList].sort((a, b) =>
                    a.given_name!.localeCompare(b.given_name!)
                )
                const filter: IEntityFilter = {
                    givenName: {
                        operator: 'neq',
                        value: usersOrderedByGivenNameAsc[0].given_name!,
                    },
                }

                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: getAdminAuthToken() },
                    filter,
                    {
                        field: 'givenName',
                        order: 'ASC',
                    }
                )

                for (let i = 0; i < usersConnection.edges.length; i++) {
                    expect(usersConnection.edges[i].node.givenName).to.eq(
                        usersOrderedByGivenNameAsc[i + 1].given_name
                    )
                }
            })
        })
    })

    describe('permissionsConnection', () => {
        let firstPermission: any
        let lastPermission: any

        beforeEach(async () => {
            await RolesInitializer.run()
        })

        context('when seeking forward', () => {
            const direction = 'FORWARD'

            context('and no direction args are specified', () => {
                beforeEach(async () => {
                    await RolesInitializer.run()
                    const permissions = await Permission.find({
                        take: 50,
                        order: { permission_id: 'ASC' },
                    })
                    firstPermission = permissions[0]
                    lastPermission = permissions.pop()
                })

                it('returns the expected permissions with the default page size', async () => {
                    const gqlPermissions = await permissionsConnection(
                        testClient,
                        direction,
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )

                    expect(gqlPermissions?.totalCount).to.eql(448)
                    expect(gqlPermissions?.edges.length).to.equal(50)

                    expect(gqlPermissions?.pageInfo.startCursor).to.equal(
                        convertDataToCursor({
                            permission_id: firstPermission.permission_id,
                        })
                    )
                    expect(gqlPermissions?.pageInfo.endCursor).to.equal(
                        convertDataToCursor({
                            permission_id: lastPermission.permission_id,
                        })
                    )
                    expect(gqlPermissions?.pageInfo.hasNextPage).to.be.true
                    expect(gqlPermissions?.pageInfo.hasPreviousPage).to.be.false
                })
            })

            context('and direction args are specified', () => {
                let directionArgs: any

                beforeEach(async () => {
                    await RolesInitializer.run()
                    const permissions = await Permission.find({
                        take: 4,
                        order: { permission_id: 'ASC' },
                    })

                    const cursor = convertDataToCursor({
                        permission_id: permissions[0]?.permission_id || '',
                    })
                    directionArgs = { count: 3, cursor: cursor }
                    firstPermission = permissions[1]
                    lastPermission = permissions.pop()
                })

                it('returns the expected permissions with the specified page size', async () => {
                    const gqlPermissions = await permissionsConnection(
                        testClient,
                        direction,
                        directionArgs,
                        { authorization: getAdminAuthToken() }
                    )

                    expect(gqlPermissions?.totalCount).to.eql(448)
                    expect(gqlPermissions?.edges.length).to.equal(3)

                    expect(gqlPermissions?.pageInfo.startCursor).to.equal(
                        convertDataToCursor({
                            permission_id: firstPermission.permission_id,
                        })
                    )
                    expect(gqlPermissions?.pageInfo.endCursor).to.equal(
                        convertDataToCursor({
                            permission_id: lastPermission.permission_id,
                        })
                    )
                    expect(gqlPermissions?.pageInfo.hasNextPage).to.be.true
                    expect(gqlPermissions?.pageInfo.hasPreviousPage).to.be.true
                })
            })
            context('and filter args are specified', async () => {
                let filter: IEntityFilter = {
                    permission_id: {
                        operator: 'eq',
                        value: 'add_content_learning_outcomes_433',
                    },
                }
                let gqlPermissions = await permissionsConnection(
                    testClient,
                    direction,
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )
                expect(gqlPermissions?.totalCount).to.eql(1)

                filter = {
                    permission_id: {
                        operator: 'contains',
                        value: 'learning',
                    },
                }
                gqlPermissions = await permissionsConnection(
                    testClient,
                    direction,
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )
                expect(gqlPermissions?.totalCount).to.eql(27)
                expect(gqlPermissions?.edges.length).to.equal(10)
            })
        })
    })

    describe('renameDuplicateOrganizations', () => {
        const organizationName = 'Organization 1'

        beforeEach(async () => {
            for (let i = 0; i < 3; i += 1) {
                const organization = new Organization()
                organization.organization_name = organizationName
                await organization.save()

                const nullOrganization = new Organization()
                await nullOrganization.save()
            }
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                const fn = async () =>
                    await renameDuplicateOrganizationsQuery(testClient)
                expect(fn()).to.be.rejected

                const nullOrgs = await Organization.count({
                    where: { organization_name: null },
                })
                const duplicatedOrgs = await Organization.count({
                    where: { organization_name: organizationName },
                })
                expect(nullOrgs).eq(3)
                expect(duplicatedOrgs).eq(3)
            })
        })

        context('when user has not Admin permissions', () => {
            it('should throw an error', async () => {
                const fn = async () =>
                    await renameDuplicateOrganizationsMutation(testClient)
                expect(fn()).to.be.rejected

                const nullOrgs = await Organization.count({
                    where: { organization_name: null },
                })
                const duplicatedOrgs = await Organization.count({
                    where: { organization_name: organizationName },
                })
                expect(nullOrgs).eq(3)
                expect(duplicatedOrgs).eq(3)
            })
        })

        context('when user has Admin permissions', () => {
            it('should throw an error', async () => {
                const result = await renameDuplicateOrganizationsMutation(
                    testClient,
                    getAdminAuthToken()
                )
                expect(result).eq(true)

                const nullOrgs = await Organization.count({
                    where: { organization_name: null },
                })
                const duplicatedOrgs = await Organization.count({
                    where: { organization_name: organizationName },
                })
                expect(nullOrgs).eq(0)
                expect(duplicatedOrgs).eq(1)
            })
        })
    })

    describe('renameDuplicateSubjects', () => {
        const subjectName = 'Subject 1'
        let organization: Organization

        beforeEach(async () => {
            organization = new Organization()
            await organization.save()

            for (let i = 0; i < 3; i += 1) {
                const subject = new Subject()
                subject.name = subjectName
                subject.organization = Promise.resolve(organization)
                await subject.save()
            }
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                const fn = async () =>
                    await renameDuplicateSubjectsQuery(testClient)

                expect(fn()).to.be.rejected

                const duplicatedSubjects = await Subject.count({
                    where: { name: subjectName, organization },
                })

                expect(duplicatedSubjects).eq(3)
            })
        })

        context('when user has not Admin permissions', () => {
            it('should throw an error', async () => {
                const fn = async () =>
                    it('should rename the duplicated subjects', async () => {
                        const result = await renameDuplicateSubjectsMutation(
                            testClient,
                            getAdminAuthToken()
                        )

                        expect(result).eq(true)

                        const duplicatedSubjects = await Subject.count({
                            where: { name: subjectName, organization },
                        })

                        expect(duplicatedSubjects).eq(1)
                    })
            })
        })
    })

    describe('renameDuplicateGrades', () => {
        const gradeName = 'Grade 1'
        let organization: Organization

        beforeEach(async () => {
            organization = new Organization()
            await organization.save()

            for (let i = 0; i < 3; i += 1) {
                const grade = new Grade()
                grade.name = gradeName
                grade.organization = Promise.resolve(organization)
                await grade.save()
            }
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                const fn = async () =>
                    await renameDuplicateGradesQuery(testClient)

                expect(fn()).to.be.rejected

                const duplicatedGrades = await Grade.count({
                    where: { name: gradeName, organization },
                })

                expect(duplicatedGrades).eq(3)
            })
        })

        context('when user has not Admin permissions', () => {
            it('should throw an error', async () => {
                const fn = async () =>
                    await renameDuplicateGradesMutation(testClient)

                expect(fn()).to.be.rejected

                const duplicatedGrades = await Grade.count({
                    where: { name: gradeName, organization },
                })

                expect(duplicatedGrades).eq(3)
            })
        })

        context('when user has Admin permissions', () => {
            it('should rename the duplicated grades', async () => {
                const result = await renameDuplicateGradesMutation(
                    testClient,
                    getAdminAuthToken()
                )

                expect(result).eq(true)

                const duplicatedGrades = await Grade.count({
                    where: { name: gradeName, organization },
                })

                expect(duplicatedGrades).eq(1)
            })
        })
    })
})
