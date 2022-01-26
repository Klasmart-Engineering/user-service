import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { AgeRange } from '../../src/entities/ageRange'
import { Grade } from '../../src/entities/grade'
import { Organization } from '../../src/entities/organization'
import { Program } from '../../src/entities/program'
import { Status } from '../../src/entities/status'
import { Subject } from '../../src/entities/subject'
import { Model } from '../../src/model'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    CreatePrograms,
    CreateProgramsEntityMap,
} from '../../src/resolvers/program'
import {
    CreateProgramInput,
    ProgramConnectionNode,
} from '../../src/types/graphQL/program'
import { createServer } from '../../src/utils/createServer'
import { mutate } from '../../src/utils/mutations/commonStructure'
import { ObjMap } from '../../src/utils/stringUtils'
import { createAgeRange, createAgeRanges } from '../factories/ageRange.factory'
import { createGrade, createGrades } from '../factories/grade.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createProgram } from '../factories/program.factory'
import { createRole } from '../factories/role.factory'
import { createSubject, createSubjects } from '../factories/subject.factory'
import { createUser } from '../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { userToPayload } from '../utils/operations/userOps'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { PermissionName } from './../../src/permissions/permissionNames'
import { v4 as uuid_v4 } from 'uuid'
import { APIError } from '../../src/types/errors/apiError'
import { compareErrors } from '../utils/apiError'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
    createInputLengthAPIError,
} from '../../src/utils/resolvers/errors'

use(deepEqualInAnyOrder)
use(chaiAsPromised)

describe('subject', () => {
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

    const createInitialData = async (permissionNames: PermissionName[]) => {
        const clientUser = await createUser().save()
        const organization = await createOrganization().save()
        const role = await createRole(undefined, organization, {
            permissions: permissionNames,
        }).save()

        await createOrganizationMembership({
            user: clientUser,
            organization: organization,
            roles: [role],
        }).save()

        const permissions = new UserPermissions(userToPayload(clientUser))
        const context = { permissions }
        return { organization, context }
    }

    const getAgeRanges = async () =>
        await AgeRange.save(
            createAgeRanges(3, undefined, undefined, undefined, true)
        )

    const getGrades = async () =>
        await Grade.save(createGrades(3, undefined, undefined, undefined, true))

    const getSubjects = async () =>
        await Subject.save(createSubjects(3, undefined, undefined, true))

    const compareProgramConnectionNodeWithInput = (
        subject: ProgramConnectionNode,
        input: CreateProgramInput
    ) => {
        expect(subject.name).to.eq(input.name)
        expect(subject.status).to.eq(Status.ACTIVE)
        expect(subject.system).to.equal(false)
    }

    const compareDBProgramWithInput = async (
        input: CreateProgramInput,
        dbProgram: Program,
        org: Organization
    ) => {
        expect(dbProgram.name).to.eq(input.name)
        expect(dbProgram.status).to.eq(Status.ACTIVE)
        expect(dbProgram.system).to.eq(false)
        expect((await dbProgram.organization)?.organization_id).to.eq(
            org.organization_id
        )

        const dbProgramAgeRangeIds = (await dbProgram.age_ranges)?.map(
            (ar) => ar.id
        )
        expect(dbProgramAgeRangeIds).to.deep.equalInAnyOrder(input.ageRangeIds)

        const dbProgramGradeIds = (await dbProgram.grades)?.map((g) => g.id)
        expect(dbProgramGradeIds).to.deep.equalInAnyOrder(input.gradeIds)

        const dbProgramSubjectIds = (await dbProgram.subjects)?.map((s) => s.id)
        expect(dbProgramSubjectIds).to.deep.equalInAnyOrder(input.subjectIds)
    }

    const generateExistingPrograms = async (org: Organization) => {
        const existingProgram = await createProgram(org).save()
        const nonPermittedOrgProgram = await createProgram(
            await createOrganization().save()
        ).save()

        const inactiveProgram = createProgram(org)
        inactiveProgram.status = Status.INACTIVE
        await inactiveProgram.save()

        const inactiveOrg = createOrganization()
        inactiveOrg.status = Status.INACTIVE
        await inactiveOrg.save()
        const inactiveOrgProgram = await createProgram(inactiveOrg).save()

        return [
            existingProgram,
            nonPermittedOrgProgram,
            inactiveProgram,
            inactiveOrgProgram,
        ]
    }

    const makeUserWithPermission = async (permission: PermissionName) => {
        const clientUser = await createUser().save()
        const permittedOrg = await createOrganization().save()
        const role = await createRole(undefined, permittedOrg, {
            permissions: [permission],
        }).save()

        await createOrganizationMembership({
            user: clientUser,
            organization: permittedOrg,
            roles: [role],
        }).save()

        const permissions = new UserPermissions(userToPayload(clientUser))
        return { permittedOrg, userCtx: { permissions } }
    }

    describe('createPrograms', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let ageRanges: AgeRange[]
        let grades: Grade[]
        let subjects: Subject[]
        let createPrograms: CreatePrograms

        beforeEach(async () => {
            const data = await createInitialData([
                PermissionName.create_program_20221,
            ])

            org = data.organization
            ctx = data.context
            ageRanges = await getAgeRanges()
            grades = await getGrades()
            subjects = await getSubjects()
            createPrograms = new CreatePrograms([], ctx.permissions)
        })

        const buildDefaultInput = (quantity: number) => {
            return Array.from(new Array(quantity), () => {
                return {
                    organizationId: org.organization_id,
                    name: faker.random.word(),
                    ageRangeIds: ageRanges.map((ar) => ar.id),
                    gradeIds: grades.map((g) => g.id),
                    subjectIds: subjects.map((s) => s.id),
                }
            })
        }

        context('complete mutation calls', () => {
            it('can create a program', async () => {
                const input: CreateProgramInput[] = buildDefaultInput(1)
                const { programs } = await mutate(
                    CreatePrograms,
                    { input },
                    ctx.permissions
                )

                expect(programs).to.have.lengthOf(1)
                expect(programs[0].id).to.not.be.undefined
                compareProgramConnectionNodeWithInput(programs[0], input[0])

                const dbPrograms = await Program.find()
                expect(dbPrograms).to.have.lengthOf(1)
                await compareDBProgramWithInput(input[0], dbPrograms[0], org)
            })

            const getDbCallCount = async (input: CreateProgramInput[]) => {
                connection.logger.reset()
                await mutate(CreatePrograms, { input }, ctx.permissions)
                return connection.logger.count
            }

            it('db connections do not increase with number of input elements', async () => {
                await getDbCallCount(buildDefaultInput(1)) // warm up permissions cache
                const singleProgramCount = await getDbCallCount(
                    buildDefaultInput(1)
                )

                const twoProgramsCount = await getDbCallCount(
                    buildDefaultInput(2)
                )

                expect(twoProgramsCount).to.be.eq(singleProgramCount)
                expect(twoProgramsCount).to.be.equal(11)
            })
        })

        context('generateEntityMaps', () => {
            it('returns existing programs', async () => {
                const existingPrograms = await generateExistingPrograms(org)
                const expectedPairs = await Promise.all(
                    existingPrograms
                        .filter((ep) => ep.status === Status.ACTIVE)
                        .map(async (ep) => {
                            return {
                                organizationId: (await ep.organization)!
                                    .organization_id,
                                name: ep.name!,
                            }
                        })
                )

                const input: CreateProgramInput[] = [
                    ...expectedPairs,
                    ...buildDefaultInput(1),
                ]

                const entityMaps = await createPrograms.generateEntityMaps(
                    input
                )

                expect(
                    Array.from(entityMaps.conflictingNames.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
            })
        })

        context('authorize', () => {
            const callAuthorize = (
                userCtx: { permissions: UserPermissions },
                orgIds: string[]
            ) => {
                const mutation = new CreatePrograms([], userCtx.permissions)
                const input = orgIds.map((orgId) => {
                    return {
                        organizationId: orgId,
                        name: faker.random.word(),
                    }
                })

                return mutation.authorize(input)
            }

            const expectPermissionError = async (
                userCtx: { permissions: UserPermissions },
                orgs: Organization[]
            ) => {
                await expect(
                    callAuthorize(
                        userCtx,
                        orgs.map((o) => o.organization_id)
                    )
                ).to.be.eventually.rejectedWith(
                    /User\(.*\) does not have Permission\(create_program_20221\) in Organizations\(.*\)/
                )
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_program_20221
                )

                await expect(
                    callAuthorize(userCtx, [permittedOrg.organization_id])
                ).to.be.eventually.fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.edit_program_20331
                )

                await expectPermissionError(userCtx, [permittedOrg])
            })

            it('checks all organizations', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_program_20221
                )

                const {
                    permittedOrg: notPermittedOrg,
                } = await makeUserWithPermission(
                    PermissionName.edit_program_20331
                )

                await expectPermissionError(userCtx, [
                    permittedOrg,
                    notPermittedOrg,
                ])
            })
        })

        context('validationOverAllInputs', () => {
            let inputs: CreateProgramInput[]
            beforeEach(() => {
                inputs = buildDefaultInput(3)
            })

            const expectInputsValidation = (error: APIError) => {
                const {
                    validInputs,
                    apiErrors,
                } = createPrograms.validationOverAllInputs(inputs)

                expect(validInputs.length).to.eq(2)
                expect(validInputs[0].input.name).to.eq(inputs[0].name)
                expect(validInputs[0].index).to.eq(0)
                expect(validInputs[1].input.name).to.eq(inputs[2].name)
                expect(validInputs[1].index).to.eq(2)
                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], error)
            }

            it("checks if exist 'name' duplicates for the same 'organizationId'", async () => {
                const duplicateInput = inputs[1]
                duplicateInput.name = inputs[0].name

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['name'],
                    'program'
                )

                expectInputsValidation(error)
            })

            it("checks if the length of 'ageRangeIds' is correct", async () => {
                const wrongAgeRangeIdsLengthInput = inputs[1]
                wrongAgeRangeIdsLengthInput.ageRangeIds = []

                const error = createInputLengthAPIError(
                    'CreateProgramInput',
                    'min',
                    'ageRangeIds',
                    1
                )

                expectInputsValidation(error)
            })

            it("checks if 'ageRangeIds' has duplicated ids", async () => {
                const ageRangeIdsDuplicatesInput = inputs[1]
                ageRangeIdsDuplicatesInput.ageRangeIds = [
                    ageRanges[0],
                    ageRanges[0],
                ].map((ar) => ar.id)

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['ageRangeIds'],
                    'CreateProgramInput'
                )

                expectInputsValidation(error)
            })

            it("checks if the length of 'gradeIds' is correct", async () => {
                const wrongGradeIdsLengthInput = inputs[1]
                wrongGradeIdsLengthInput.gradeIds = []

                const error = createInputLengthAPIError(
                    'CreateProgramInput',
                    'min',
                    'gradeIds',
                    1
                )

                expectInputsValidation(error)
            })

            it("checks if 'gradeIds' has duplicated ids", async () => {
                const gradeIdsDuplicatesInput = inputs[1]
                gradeIdsDuplicatesInput.gradeIds = [grades[0], grades[0]].map(
                    (g) => g.id
                )

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['gradeIds'],
                    'CreateProgramInput'
                )

                expectInputsValidation(error)
            })

            it("checks if the length of 'subjectIds' is correct", async () => {
                const wrongSubjectIdsLengthInput = inputs[1]
                wrongSubjectIdsLengthInput.subjectIds = []

                const error = createInputLengthAPIError(
                    'CreateProgramInput',
                    'min',
                    'subjectIds',
                    1
                )

                expectInputsValidation(error)
            })

            it("checks if 'subjectIds' has duplicated ids", async () => {
                const subjectIdsDuplicatesInput = inputs[1]
                subjectIdsDuplicatesInput.subjectIds = [
                    subjects[0],
                    subjects[0],
                ].map((c) => c.id)

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['subjectIds'],
                    'CreateProgramInput'
                )

                expectInputsValidation(error)
            })
        })

        const buildEntityMap = async (
            programsToUse: Program[] = [],
            ageRangesToUse: AgeRange[] = [],
            gradesToUse: Grade[] = [],
            subjectsToUse: Subject[] = []
        ) => {
            const entityMap: CreateProgramsEntityMap = {
                conflictingNames: new ObjMap([]),
                organizations: new Map([]),
                ageRanges: new Map([]),
                grades: new Map([]),
                subjects: new Map([]),
            }

            for (const program of programsToUse) {
                if (program.id === undefined) {
                    program.id = uuid_v4()
                }

                const programOrg = (await program.organization)!

                entityMap.organizations.set(
                    programOrg.organization_id,
                    programOrg
                )

                entityMap.conflictingNames.set(
                    {
                        organizationId: programOrg.organization_id,
                        name: program.name!,
                    },
                    program
                )
            }

            for (const ageRange of ageRangesToUse) {
                entityMap.ageRanges.set(ageRange.id, ageRange)
            }

            for (const grade of gradesToUse) {
                entityMap.grades.set(grade.id, grade)
            }

            for (const subject of subjectsToUse) {
                entityMap.subjects.set(subject.id, subject)
            }

            return entityMap
        }

        context('validate', () => {
            const runTestCases = (
                testCases: { input: CreateProgramInput; error?: APIError }[],
                entityMap: CreateProgramsEntityMap
            ) => {
                for (const { input, error } of testCases) {
                    const errors = createPrograms.validate(
                        0,
                        undefined,
                        input,
                        entityMap
                    )

                    if (error !== undefined) {
                        expect(errors.length).to.eq(1)
                        compareErrors(errors[0], error)
                    }
                }
            }

            const createSingleInput = (
                organization: Organization,
                name = faker.random.word(),
                ageRangesToUse?: AgeRange[],
                gradesToUse?: Grade[],
                subjectsToUse?: Subject[]
            ) => {
                return {
                    organizationId: organization.organization_id,
                    name,
                    ageRangeIds: ageRangesToUse?.map((ar) => ar.id),
                    gradeIds: gradesToUse?.map((g) => g.id),
                    subjectIds: subjectsToUse?.map((s) => s.id),
                }
            }

            it("checks if the organization with the given 'organizationId' exists", async () => {
                const inactiveOrg = createOrganization()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()

                const input = createSingleInput(inactiveOrg)
                const error = createEntityAPIError(
                    'nonExistent',
                    0,
                    'Organization',
                    inactiveOrg.organization_id
                )

                const entityManager = await buildEntityMap()
                runTestCases([{ input, error }], entityManager)
            })

            it("checks if the age range in the given 'ageRangeIds' array exists", async () => {
                const program = await createProgram(org)
                const inactiveAgeRange = createAgeRange()
                inactiveAgeRange.status = Status.INACTIVE
                await inactiveAgeRange.save()

                const input = createSingleInput(org, undefined, [
                    inactiveAgeRange,
                ])

                const error = createEntityAPIError(
                    'nonExistent',
                    0,
                    'AgeRange',
                    inactiveAgeRange.id
                )

                const entityMap = await buildEntityMap([program])
                runTestCases([{ input, error }], entityMap)
            })

            it("checks if the age range in the given 'ageRangeIds' array exists in the organization given in 'organizationId'", async () => {
                const program = await createProgram(org)
                const otherOrg = await createOrganization().save()
                const nonBelongingAgeRange = await createAgeRange(
                    otherOrg
                ).save()

                const input = createSingleInput(org, undefined, [
                    nonBelongingAgeRange,
                ])

                const error = createEntityAPIError(
                    'nonExistentChild',
                    0,
                    'AgeRange',
                    nonBelongingAgeRange.id,
                    'Organization',
                    org.organization_id
                )

                const entityManager = await buildEntityMap(
                    [program],
                    [...ageRanges, nonBelongingAgeRange]
                )

                runTestCases([{ input, error }], entityManager)
            })

            it("checks if the grade in the given 'gradeIds' array exists", async () => {
                const program = await createProgram(org)
                const inactiveGrade = createGrade()
                inactiveGrade.status = Status.INACTIVE
                await inactiveGrade.save()

                const input = createSingleInput(org, undefined, undefined, [
                    inactiveGrade,
                ])

                const error = createEntityAPIError(
                    'nonExistent',
                    0,
                    'Grade',
                    inactiveGrade.id
                )

                const entityMap = await buildEntityMap([program])
                runTestCases([{ input, error }], entityMap)
            })

            it("checks if the grade in the given 'gradeIds' array exists in the organization given in 'organizationId'", async () => {
                const program = await createProgram(org)
                const otherOrg = await createOrganization().save()
                const nonBelongingGrade = await createGrade(otherOrg).save()

                const input = createSingleInput(org, undefined, undefined, [
                    nonBelongingGrade,
                ])

                const error = createEntityAPIError(
                    'nonExistentChild',
                    0,
                    'Grade',
                    nonBelongingGrade.id,
                    'Organization',
                    org.organization_id
                )

                const entityManager = await buildEntityMap(
                    [program],
                    undefined,
                    [...grades, nonBelongingGrade]
                )

                runTestCases([{ input, error }], entityManager)
            })

            it("checks if the subject in the given 'subjectIds' array exists", async () => {
                const program = await createProgram(org)
                const inactiveSubject = createSubject()
                inactiveSubject.status = Status.INACTIVE
                await inactiveSubject.save()

                const input = createSingleInput(
                    org,
                    undefined,
                    undefined,
                    undefined,
                    [inactiveSubject]
                )

                const error = createEntityAPIError(
                    'nonExistent',
                    0,
                    'Subject',
                    inactiveSubject.id
                )

                const entityMap = await buildEntityMap([program])
                runTestCases([{ input, error }], entityMap)
            })

            it("checks if the subject in the given 'subjectIds' array exists in the organization given in 'organizationId'", async () => {
                const program = await createProgram(org)
                const otherOrg = await createOrganization().save()
                const nonBelongingSubject = await createSubject(otherOrg).save()

                const input = createSingleInput(
                    org,
                    undefined,
                    undefined,
                    undefined,
                    [nonBelongingSubject]
                )

                const error = createEntityAPIError(
                    'nonExistentChild',
                    0,
                    'Subject',
                    nonBelongingSubject.id,
                    'Organization',
                    org.organization_id
                )

                const entityManager = await buildEntityMap(
                    [program],
                    undefined,
                    undefined,
                    [...subjects, nonBelongingSubject]
                )

                runTestCases([{ input, error }], entityManager)
            })

            it("checks if a program already exists in the DB with the given 'name' in the organization given in 'organizationId", async () => {
                const programInSameOrg = createProgram(org)
                programInSameOrg.id = uuid_v4()

                const inactiveProgramInSameOrg = createProgram(org)
                inactiveProgramInSameOrg.id = uuid_v4()
                inactiveProgramInSameOrg.status = Status.INACTIVE

                const differentOrg = await createOrganization().save()
                const programInDifferentOrg = createProgram(differentOrg)

                const testCases: {
                    input: CreateProgramInput
                    error?: APIError
                }[] = await Promise.all(
                    [programInSameOrg, inactiveProgramInSameOrg].map(
                        async (s) => {
                            const organization = (await s.organization)!
                            return {
                                input: createSingleInput(organization, s.name!),
                                error: createExistentEntityAttributeAPIError(
                                    'Program',
                                    s.id,
                                    'name',
                                    s.name!,
                                    0
                                ),
                            }
                        }
                    )
                )

                testCases.push({
                    input: createSingleInput(
                        await programInDifferentOrg.organization!,
                        programInDifferentOrg.name!
                    ),
                })

                const entityMap = await buildEntityMap(
                    [
                        programInSameOrg,
                        inactiveProgramInSameOrg,
                        programInDifferentOrg,
                    ],
                    ageRanges,
                    grades,
                    subjects
                )

                runTestCases(testCases, entityMap)
            })
        })
    })
})
