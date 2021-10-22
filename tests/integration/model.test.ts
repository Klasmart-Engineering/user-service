import { expect, use } from 'chai'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { createAgeRange } from '../factories/ageRange.factory'
import { createGrade } from '../factories/grade.factory'
import { createOrganization } from '../factories/organization.factory'
import { createSubcategory } from '../factories/subcategory.factory'
import {
    getAgeRange,
    getGrade,
    getSubcategory,
    getAllOrganizations,
    getOrganizations,
    myUsers,
    getProgram,
    permissionsConnection,
} from '../utils/operations/modelOps'
import { getAdminAuthToken, getNonAdminAuthToken } from '../utils/testConfig'
import {
    createOrganizationAndValidate,
    addOrganizationToUserAndValidate,
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
import { before } from 'mocha'
import RolesInitializer from '../../src/initializers/roles'
import {
    renameDuplicateOrganizationsMutation,
    renameDuplicateOrganizationsQuery,
} from '../utils/operations/renameDuplicateOrganizations'
import { IEntityFilter } from '../../src/utils/pagination/filtering'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Status } from '../../src/entities/status'
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
import deepEqualInAnyOrder from 'deep-equal-in-any-order'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('model', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
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
            xit('fails authentication', async () => {
                const gqlResult = myUsers(testClient, {
                    authorization: '',
                })
                await expect(gqlResult).to.be.rejectedWith(
                    Error,
                    'Context creation failed: No authentication token'
                )
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
                const gqlUsers = await myUsers(testClient, {
                    authorization: getNonAdminAuthToken(),
                })

                expect(gqlUsers.length).to.equal(0)
            })
        })
        context('when user is inactive', () => {
            beforeEach(async () => {
                const dbOtherUser = await User.findOneOrFail(otherUser.user_id)
                if (dbOtherUser) {
                    dbOtherUser.status = Status.INACTIVE
                    await connection.manager.save(dbOtherUser)
                }
            })

            it('returns no users', async () => {
                const gqlUsers = await myUsers(testClient, {
                    authorization: getNonAdminAuthToken(),
                })
                expect(gqlUsers.length).to.equal(0)
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
            xit('fails authentication', async () => {
                const gqlResult = getAllOrganizations(testClient, {
                    authorization: undefined,
                })

                await expect(gqlResult).to.be.rejectedWith(
                    Error,
                    'Context creation failed: No authentication token'
                )
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
            // skipped temporarily because authorization check is not currently in place/was removed
            // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
            context.skip('and the user is not an admin', () => {
                it('raises an error', async () => {
                    await expect(
                        getAllOrganizations(testClient, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
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
            xit('fails authentication', async () => {
                const gqlResult = getAgeRange(testClient, ageRange.id, {
                    authorization: undefined,
                })

                await expect(gqlResult).to.be.rejectedWith(
                    Error,
                    'Context creation failed: No authentication token'
                )
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
            xit('fails authentication', async () => {
                const gqlGrade = getGrade(testClient, grade.id, {
                    authorization: undefined,
                })

                await expect(gqlGrade).to.be.rejectedWith(
                    Error,
                    'Context creation failed: No authentication token'
                )
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
            xit('fails authentication', async () => {
                const gqlSubcategory = getSubcategory(
                    testClient,
                    subcategory.id,
                    { authorization: undefined }
                )

                await expect(gqlSubcategory).to.be.rejectedWith(
                    Error,
                    'Context creation failed: No authentication token'
                )
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
            xit('fails authentication', async () => {
                const gqlResult = getProgram(testClient, program.id, {
                    authorization: undefined,
                })

                await expect(gqlResult).to.be.rejectedWith(
                    Error,
                    'Context creation failed: No authentication token'
                )
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
                await expect(renameDuplicateOrganizationsQuery(testClient)).to
                    .be.rejected

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
                await expect(renameDuplicateOrganizationsMutation(testClient))
                    .to.be.rejected

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
                await expect(renameDuplicateSubjectsQuery(testClient)).to.be
                    .rejected

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
                await expect(renameDuplicateGradesQuery(testClient)).to.be
                    .rejected

                const duplicatedGrades = await Grade.count({
                    where: { name: gradeName, organization },
                })

                expect(duplicatedGrades).eq(3)
            })
        })

        context('when user has not Admin permissions', () => {
            it('should throw an error', async () => {
                await expect(renameDuplicateGradesMutation(testClient)).to.be
                    .rejected

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
