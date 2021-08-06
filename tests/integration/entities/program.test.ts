import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import chaiAsPromised from 'chai-as-promised'

import { AgeRange } from '../../../src/entities/ageRange'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    addUserToOrganizationAndValidate,
    createRole,
} from '../../utils/operations/organizationOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import { getNonAdminAuthToken, getAdminAuthToken } from '../../utils/testConfig'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createGrade } from '../../factories/grade.factory'
import { createProgram } from '../../factories/program.factory'
import { createSubject } from '../../factories/subject.factory'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { createOrganization } from '../../factories/organization.factory'
import { createTestConnection } from '../../utils/testConnection'
import {
    deleteProgram,
    editAgeRanges,
    editGrades,
    editSubjects,
} from '../../utils/operations/programOps'
import { Grade } from '../../../src/entities/grade'
import { grantPermission } from '../../utils/operations/roleOps'
import { Model } from '../../../src/model'
import { Organization } from '../../../src/entities/organization'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Program } from '../../../src/entities/program'
import { Subject } from '../../../src/entities/subject'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'

use(chaiAsPromised)

describe('program', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let user: User
    let org: Organization
    let program: Program
    let organizationId: string
    let userId: string

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        user = await createAdminUser(testClient)
        userId = user.user_id

        org = createOrganization({})
        await connection.manager.save(org)
        organizationId = org.organization_id
        program = createProgram(org)
        await connection.manager.save(program)
    })

    describe('delete', () => {
        context('when user is not logged in', () => {
            it('cannot find the program', async () => {
                const gqlBool = await deleteProgram(testClient, program.id, {
                    authorization: undefined,
                })

                expect(gqlBool).to.be.undefined
            })
        })

        context('when user is logged in', () => {
            let otherUserId: string
            let roleId: string

            context('and the user is not an admin', () => {
                beforeEach(async () => {
                    const otherUser = await createNonAdminUser(testClient)
                    otherUserId = otherUser.user_id
                })

                context(
                    'and does not belong to the organization from the program',
                    () => {
                        it('cannot find the program', async () => {
                            const gqlBool = await deleteProgram(
                                testClient,
                                program.id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            expect(gqlBool).to.be.undefined
                        })
                    }
                )

                context(
                    'and belongs to the organization from the program',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                otherUserId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                            roleId = (
                                await createRole(
                                    testClient,
                                    organizationId,
                                    'My Role'
                                )
                            ).role_id
                            await addRoleToOrganizationMembership(
                                testClient,
                                otherUserId,
                                organizationId,
                                roleId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context('with a non system program', () => {
                            context(
                                'and has delete program permissions',
                                () => {
                                    beforeEach(async () => {
                                        await grantPermission(
                                            testClient,
                                            roleId,
                                            PermissionName.delete_program_20441,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )
                                    })

                                    it('deletes the expected program', async () => {
                                        let dbProgram = await Program.findOneOrFail(
                                            program.id
                                        )

                                        expect(dbProgram.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbProgram.deleted_at).to.be.null

                                        const gqlBool = await deleteProgram(
                                            testClient,
                                            program.id,
                                            {
                                                authorization: getNonAdminAuthToken(),
                                            }
                                        )

                                        expect(gqlBool).to.be.true
                                        dbProgram = await Program.findOneOrFail(
                                            program.id
                                        )
                                        expect(dbProgram.status).to.eq(
                                            Status.INACTIVE
                                        )
                                        expect(dbProgram.deleted_at).not.to.be
                                            .null
                                    })

                                    context(
                                        'with the program already deleted',
                                        () => {
                                            beforeEach(async () => {
                                                await deleteProgram(
                                                    testClient,
                                                    program.id,
                                                    {
                                                        authorization: getAdminAuthToken(),
                                                    }
                                                )
                                            })

                                            it('cannot delete the program', async () => {
                                                const gqlBool = await deleteProgram(
                                                    testClient,
                                                    program.id,
                                                    {
                                                        authorization: getNonAdminAuthToken(),
                                                    }
                                                )

                                                expect(gqlBool).to.be.false
                                                const dbProgram = await Program.findOneOrFail(
                                                    program.id
                                                )
                                                expect(dbProgram.status).to.eq(
                                                    Status.INACTIVE
                                                )
                                                expect(dbProgram.deleted_at).not
                                                    .to.be.null
                                            })
                                        }
                                    )
                                }
                            )

                            context(
                                'and does not have delete program permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        const fn = () =>
                                            deleteProgram(
                                                testClient,
                                                program.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )

                                        expect(fn()).to.be.rejected
                                        const dbProgram = await Program.findOneOrFail(
                                            program.id
                                        )

                                        expect(dbProgram.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbProgram.deleted_at).to.be.null
                                    })
                                }
                            )
                        })

                        context('with a system program', () => {
                            beforeEach(async () => {
                                program.system = true
                                await connection.manager.save(program)
                            })

                            context(
                                'and has delete program permissions',
                                () => {
                                    beforeEach(async () => {
                                        await grantPermission(
                                            testClient,
                                            roleId,
                                            PermissionName.delete_age_range_20442,
                                            {
                                                authorization: getAdminAuthToken(),
                                            }
                                        )
                                    })

                                    it('raises a permission error', async () => {
                                        const fn = () =>
                                            deleteProgram(
                                                testClient,
                                                program.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )

                                        expect(fn()).to.be.rejected
                                        const dbProgram = await Program.findOneOrFail(
                                            program.id
                                        )

                                        expect(dbProgram.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbProgram.deleted_at).to.be.null
                                    })
                                }
                            )

                            context(
                                'and does not have delete program permissions',
                                () => {
                                    it('raises a permission error', async () => {
                                        const fn = () =>
                                            deleteProgram(
                                                testClient,
                                                program.id,
                                                {
                                                    authorization: getNonAdminAuthToken(),
                                                }
                                            )

                                        expect(fn()).to.be.rejected
                                        const dbProgram = await Program.findOneOrFail(
                                            program.id
                                        )

                                        expect(dbProgram.status).to.eq(
                                            Status.ACTIVE
                                        )
                                        expect(dbProgram.deleted_at).to.be.null
                                    })
                                }
                            )
                        })
                    }
                )
            })

            context('and the user is an admin', () => {
                context(
                    'and does not belong to the organization from the program',
                    () => {
                        it('deletes the expected program', async () => {
                            let dbProgram = await Program.findOneOrFail(
                                program.id
                            )

                            expect(dbProgram.status).to.eq(Status.ACTIVE)
                            expect(dbProgram.deleted_at).to.be.null

                            const gqlBool = await deleteProgram(
                                testClient,
                                program.id,
                                { authorization: getAdminAuthToken() }
                            )

                            expect(gqlBool).to.be.true
                            dbProgram = await Program.findOneOrFail(program.id)
                            expect(dbProgram.status).to.eq(Status.INACTIVE)
                            expect(dbProgram.deleted_at).not.to.be.null
                        })
                    }
                )

                context(
                    'and belongs to the organization from the program',
                    () => {
                        beforeEach(async () => {
                            await addUserToOrganizationAndValidate(
                                testClient,
                                userId,
                                organizationId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        context('with a non system program', () => {
                            it('deletes the expected program', async () => {
                                let dbProgram = await Program.findOneOrFail(
                                    program.id
                                )

                                expect(dbProgram.status).to.eq(Status.ACTIVE)
                                expect(dbProgram.deleted_at).to.be.null

                                const gqlBool = await deleteProgram(
                                    testClient,
                                    program.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbProgram = await Program.findOneOrFail(
                                    program.id
                                )
                                expect(dbProgram.status).to.eq(Status.INACTIVE)
                                expect(dbProgram.deleted_at).not.to.be.null
                            })

                            context('with the program already deleted', () => {
                                beforeEach(async () => {
                                    await deleteProgram(
                                        testClient,
                                        program.id,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('cannot delete the program', async () => {
                                    const gqlBool = await deleteProgram(
                                        testClient,
                                        program.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbProgram = await Program.findOneOrFail(
                                        program.id
                                    )
                                    expect(dbProgram.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbProgram.deleted_at).not.to.be.null
                                })
                            })
                        })

                        context('with a system program', () => {
                            beforeEach(async () => {
                                program.system = true
                                await connection.manager.save(program)
                            })

                            it('deletes the expected program', async () => {
                                let dbProgram = await Program.findOneOrFail(
                                    program.id
                                )

                                expect(dbProgram.status).to.eq(Status.ACTIVE)
                                expect(dbProgram.deleted_at).to.be.null

                                const gqlBool = await deleteProgram(
                                    testClient,
                                    program.id,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(gqlBool).to.be.true
                                dbProgram = await Program.findOneOrFail(
                                    program.id
                                )
                                expect(dbProgram.status).to.eq(Status.INACTIVE)
                                expect(dbProgram.deleted_at).not.to.be.null
                            })

                            context('with the program already deleted', () => {
                                beforeEach(async () => {
                                    await deleteProgram(
                                        testClient,
                                        program.id,
                                        { authorization: getAdminAuthToken() }
                                    )
                                })

                                it('cannot delete the program', async () => {
                                    const gqlBool = await deleteProgram(
                                        testClient,
                                        program.id,
                                        { authorization: getAdminAuthToken() }
                                    )

                                    expect(gqlBool).to.be.false
                                    const dbProgram = await Program.findOneOrFail(
                                        program.id
                                    )
                                    expect(dbProgram.status).to.eq(
                                        Status.INACTIVE
                                    )
                                    expect(dbProgram.deleted_at).not.to.be.null
                                })
                            })
                        })
                    }
                )
            })
        })
    })

    describe('editAgeRanges', () => {
        let ageRange: AgeRange
        let otherUserId: string

        const ageRangeInfo = (ageRange: any) => {
            return ageRange.id
        }

        beforeEach(async () => {
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            ageRange = await createAgeRange({}, org).save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                const fn = () =>
                    editAgeRanges(testClient, program.id, [ageRange.id], {
                        authorization: undefined,
                    })
                expect(fn()).to.be.rejected

                const dbAgeRanges = (await program.age_ranges) || []
                expect(dbAgeRanges).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(testClient, org.organization_id)
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organizationId,
                    role.role_id
                )
            })

            context(
                'and the user does not have edit program permissions',
                () => {
                    it('throws a permission error', async () => {
                        const fn = () =>
                            editAgeRanges(
                                testClient,
                                program.id,
                                [ageRange.id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        expect(fn()).to.be.rejected

                        const dbAgeRanges = (await program.age_ranges) || []
                        expect(dbAgeRanges).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_program_20331,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the program age ranges', async () => {
                    let dbProgram = await Program.findOneOrFail(program.id)
                    let dbAgeRanges = (await dbProgram.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty

                    let gqlAgeRanges = await editAgeRanges(
                        testClient,
                        program.id,
                        [ageRange.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbProgram = await Program.findOneOrFail(program.id)
                    dbAgeRanges = (await dbProgram.age_ranges) || []
                    expect(dbAgeRanges).not.to.be.empty
                    expect(dbAgeRanges.map(ageRangeInfo)).to.deep.eq(
                        gqlAgeRanges.map(ageRangeInfo)
                    )

                    gqlAgeRanges = await editAgeRanges(
                        testClient,
                        program.id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    dbProgram = await Program.findOneOrFail(program.id)
                    dbAgeRanges = (await dbProgram.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteProgram(testClient, program.id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the program age ranges', async () => {
                        const gqlAgeRanges = await editAgeRanges(
                            testClient,
                            program.id,
                            [ageRange.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlAgeRanges).to.be.null

                        const dbAgeRanges = (await program.age_ranges) || []
                        expect(dbAgeRanges).to.be.empty
                    })
                })
            })
        })
    })

    describe('editGrades', () => {
        let grade: Grade
        let otherUserId: string

        const gradeInfo = (grade: any) => {
            return grade.id
        }

        beforeEach(async () => {
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            grade = createGrade(org)
            await grade.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                const fn = () =>
                    editGrades(testClient, program.id, [grade.id], {
                        authorization: undefined,
                    })
                expect(fn()).to.be.rejected

                const dbGrades = (await program.grades) || []
                expect(dbGrades).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(testClient, org.organization_id)
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organizationId,
                    role.role_id
                )
            })

            context(
                'and the user does not have edit program permissions',
                () => {
                    it('throws a permission error', async () => {
                        const fn = () =>
                            editGrades(testClient, program.id, [grade.id], {
                                authorization: getNonAdminAuthToken(),
                            })
                        expect(fn()).to.be.rejected

                        const dbGrades = (await program.grades) || []
                        expect(dbGrades).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_program_20331,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the program grades', async () => {
                    let dbProgram = await Program.findOneOrFail(program.id)
                    let dbGrades = (await dbProgram.grades) || []
                    expect(dbGrades).to.be.empty

                    let gqlGrades = await editGrades(
                        testClient,
                        program.id,
                        [grade.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbProgram = await Program.findOneOrFail(program.id)
                    dbGrades = (await dbProgram.grades) || []
                    expect(dbGrades).not.to.be.empty
                    expect(dbGrades.map(gradeInfo)).to.deep.eq(
                        gqlGrades.map(gradeInfo)
                    )

                    gqlGrades = await editGrades(testClient, program.id, [], {
                        authorization: getNonAdminAuthToken(),
                    })
                    dbProgram = await Program.findOneOrFail(program.id)
                    dbGrades = (await dbProgram.grades) || []
                    expect(dbGrades).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteProgram(testClient, program.id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the program grades', async () => {
                        const gqlGrades = await editGrades(
                            testClient,
                            program.id,
                            [grade.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlGrades).to.be.null

                        const dbGrades = (await program.grades) || []
                        expect(dbGrades).to.be.empty
                    })
                })
            })
        })
    })

    describe('editSubjects', () => {
        let subject: Subject
        let otherUserId: string

        const subjectInfo = (subject: any) => {
            return subject.id
        }

        beforeEach(async () => {
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            subject = createSubject(org)
            await subject.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                const fn = () =>
                    editSubjects(testClient, program.id, [subject.id], {
                        authorization: undefined,
                    })
                expect(fn()).to.be.rejected

                const dbSubjects = (await program.subjects) || []
                expect(dbSubjects).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(testClient, org.organization_id)
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organizationId,
                    role.role_id
                )
            })

            context(
                'and the user does not have edit program permissions',
                () => {
                    it('throws a permission error', async () => {
                        const fn = () =>
                            editSubjects(testClient, program.id, [subject.id], {
                                authorization: getNonAdminAuthToken(),
                            })
                        expect(fn()).to.be.rejected

                        const dbSubjects = (await program.subjects) || []
                        expect(dbSubjects).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_program_20331,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the program subjects', async () => {
                    let dbProgram = await Program.findOneOrFail(program.id)
                    let dbSubjects = (await dbProgram.subjects) || []
                    expect(dbSubjects).to.be.empty

                    let gqlSubjects = await editSubjects(
                        testClient,
                        program.id,
                        [subject.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbProgram = await Program.findOneOrFail(program.id)
                    dbSubjects = (await dbProgram.subjects) || []
                    expect(dbSubjects).not.to.be.empty
                    expect(dbSubjects.map(subjectInfo)).to.deep.eq(
                        gqlSubjects.map(subjectInfo)
                    )

                    gqlSubjects = await editSubjects(
                        testClient,
                        program.id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    dbProgram = await Program.findOneOrFail(program.id)
                    dbSubjects = (await dbProgram.subjects) || []
                    expect(dbSubjects).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteProgram(testClient, program.id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the program subjects', async () => {
                        const gqlSubjects = await editSubjects(
                            testClient,
                            program.id,
                            [subject.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSubjects).to.be.null

                        const dbSubjects = (await program.subjects) || []
                        expect(dbSubjects).to.be.empty
                    })
                })
            })
        })
    })
})
