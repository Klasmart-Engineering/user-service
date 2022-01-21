import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { v4 as uuid_v4 } from 'uuid'
import { Category } from '../../src/entities/category'
import { Organization } from '../../src/entities/organization'
import { Status } from '../../src/entities/status'
import { Subject } from '../../src/entities/subject'
import { Model } from '../../src/model'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    CreateSubjects,
    CreateSubjectsEntityMap,
} from '../../src/resolvers/subject'
import { APIError } from '../../src/types/errors/apiError'
import { CreateSubjectInput } from '../../src/types/graphQL/subject'
import { createServer } from '../../src/utils/createServer'
import { mutate } from '../../src/utils/mutations/commonStructure'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
    createInputLengthAPIError,
} from '../../src/utils/resolvers/errors'
import { ObjMap } from '../../src/utils/stringUtils'
import { createCategories, createCategory } from '../factories/category.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createSubject } from '../factories/subject.factory'
import { createUser } from '../factories/user.factory'
import { compareErrors } from '../utils/apiError'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { userToPayload } from '../utils/operations/userOps'
import { createTestConnection, TestConnection } from '../utils/testConnection'

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

    describe('createSubjects', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let categories: Category[]
        let createSubjects: CreateSubjects

        beforeEach(async () => {
            const clientUser = await createUser().save()
            org = await createOrganization().save()
            categories = await Category.save(
                createCategories(3, undefined, undefined, true)
            )

            const r = await createRole(undefined, org, {
                permissions: [PermissionName.create_subjects_20227],
            }).save()

            await createOrganizationMembership({
                user: clientUser,
                organization: org,
                roles: [r],
            }).save()

            const permissions = new UserPermissions(userToPayload(clientUser))
            ctx = { permissions }
            createSubjects = new CreateSubjects([], ctx.permissions)
        })

        const buildDefaultInput = (quantity: number) => {
            return Array.from(new Array(quantity), () => {
                return {
                    organizationId: org.organization_id,
                    name: faker.random.word(),
                    categoryIds: categories.map((c) => c.id),
                }
            })
        }

        context('complete mutation calls', () => {
            it('can create a subject', async () => {
                const input: CreateSubjectInput[] = buildDefaultInput(1)
                const { subjects } = await mutate(
                    CreateSubjects,
                    { input },
                    ctx.permissions
                )

                expect(subjects).to.have.lengthOf(1)
                expect(subjects[0].id).to.not.be.undefined
                expect(subjects[0].name).to.eq(input[0].name)
                expect(subjects[0].status).to.eq(Status.ACTIVE)
                expect(subjects[0].system).to.equal(false)

                const dbSubjects = await Subject.find()
                expect(dbSubjects).to.have.lengthOf(1)
                expect(dbSubjects[0].name).to.eq(input[0].name)
                expect(dbSubjects[0].status).to.eq(Status.ACTIVE)
                expect(dbSubjects[0].system).to.eq(subjects[0].system)
                expect(
                    (await dbSubjects[0].organization)?.organization_id
                ).to.eq(org.organization_id)

                const dbSubjectCategoryIds = (
                    await dbSubjects[0].categories
                )?.map((c) => c.id)
                expect(dbSubjectCategoryIds).to.deep.equalInAnyOrder(
                    input[0].categoryIds
                )
            })

            const getDbCallCount = async (input: CreateSubjectInput[]) => {
                connection.logger.reset()
                await mutate(CreateSubjects, { input }, ctx.permissions)
                return connection.logger.count
            }

            it('db connections do not increase with number of input elements', async () => {
                await getDbCallCount(buildDefaultInput(1)) // warm up permissions cache
                const singleSubjectCount = await getDbCallCount(
                    buildDefaultInput(1)
                )

                const twoSubjectCount = await getDbCallCount(
                    buildDefaultInput(2)
                )

                expect(twoSubjectCount).to.be.eq(singleSubjectCount)
                expect(twoSubjectCount).to.be.equal(7)
            })
        })

        context('generateEntityMaps', () => {
            it('returns existing subjects', async () => {
                const existingSubject = await createSubject(org).save()
                const nonPermittedOrgSubject = await createSubject(
                    await createOrganization().save()
                ).save()

                const inactiveSubject = createSubject(org)
                inactiveSubject.status = Status.INACTIVE
                await inactiveSubject.save()

                const inactiveOrg = createOrganization()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()

                const inactiveOrgSubject = await createSubject(
                    inactiveOrg
                ).save()

                const existingSubjects = [
                    existingSubject,
                    nonPermittedOrgSubject,
                    inactiveSubject,
                    inactiveOrgSubject,
                ]

                const expectedPairs = await Promise.all(
                    existingSubjects
                        .filter((es) => es.status === Status.ACTIVE)
                        .map(async (es) => {
                            return {
                                organizationId: (await es.organization)!
                                    .organization_id,
                                name: es.name!,
                            }
                        })
                )

                const input: CreateSubjectInput[] = [
                    ...expectedPairs,
                    ...buildDefaultInput(1),
                ]

                const entityMaps = await createSubjects.generateEntityMaps(
                    input
                )

                expect(
                    Array.from(entityMaps.conflictingNames.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
            })
        })

        context('authorize', () => {
            const makeUserWithPermission = async (
                permission: PermissionName
            ) => {
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

                const permissions = new UserPermissions(
                    userToPayload(clientUser)
                )

                return { permittedOrg, userCtx: { permissions } }
            }

            const callAuthorize = (
                userCtx: { permissions: UserPermissions },
                orgIds: string[]
            ) => {
                const mutation = new CreateSubjects([], userCtx.permissions)
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
                    /User\(.*\) does not have Permission\(create_subjects_20227\) in Organizations\(.*\)/
                )
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_subjects_20227
                )

                await expect(
                    callAuthorize(userCtx, [permittedOrg.organization_id])
                ).to.be.eventually.fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.edit_subjects_20337
                )

                await expectPermissionError(userCtx, [permittedOrg])
            })

            it('checks all organizations', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_subjects_20227
                )

                const {
                    permittedOrg: notPermittedOrg,
                } = await makeUserWithPermission(
                    PermissionName.edit_subjects_20337
                )

                await expectPermissionError(userCtx, [
                    permittedOrg,
                    notPermittedOrg,
                ])
            })
        })

        const buildEntityMap = async (
            subjects: Subject[],
            cats: Category[]
        ) => {
            const entityMap: CreateSubjectsEntityMap = {
                conflictingNames: new ObjMap([]),
                organizations: new Map([]),
                categories: new Map([]),
            }

            for (const subject of subjects) {
                if (subject.id === undefined) {
                    subject.id = uuid_v4()
                }

                const subjectOrg = (await subject.organization)!
                entityMap.organizations.set(
                    subjectOrg.organization_id,
                    subjectOrg
                )

                entityMap.conflictingNames.set(
                    {
                        organizationId: subjectOrg.organization_id,
                        name: subject.name!,
                    },
                    subject
                )
            }

            for (const category of cats) {
                entityMap.categories.set(category.id, category)
            }

            return entityMap
        }

        context('validationOverAllInputs', () => {
            let inputs: CreateSubjectInput[]

            beforeEach(() => {
                inputs = buildDefaultInput(3)
            })

            const expectInputsValidation = (error: APIError) => {
                const {
                    validInputs,
                    apiErrors,
                } = createSubjects.validationOverAllInputs(inputs)

                expect(validInputs.length).to.eq(2)
                expect(validInputs[0].input.name).to.eq(inputs[0].name)
                expect(validInputs[0].index).to.eq(0)
                expect(validInputs[1].input.name).to.eq(inputs[2].name)
                expect(validInputs[1].index).to.eq(2)
                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], error)
            }

            it('duplicate names', async () => {
                const duplicateInput = inputs[1]
                duplicateInput.name = inputs[0].name
                const error = createDuplicateAttributeAPIError(
                    1,
                    ['name'],
                    'subject'
                )

                expectInputsValidation(error)
            })

            it('subItemsLength', async () => {
                const wrongSubItemsLengthInput = inputs[1]
                wrongSubItemsLengthInput.categoryIds = []
                const error = createInputLengthAPIError(
                    'CreateSubjectInput',
                    'min',
                    'categoryIds',
                    1
                )

                expectInputsValidation(error)
            })

            it('subItemsDuplicates', async () => {
                const subItemsDuplicatesInput = inputs[1]
                subItemsDuplicatesInput.categoryIds = [
                    categories[0],
                    categories[0],
                ].map((c) => c.id)

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['categoryIds'],
                    'CreateSubjectInput'
                )

                expectInputsValidation(error)
            })
        })

        context('validate', () => {
            const runTestCases = (
                testCases: { input: CreateSubjectInput; error?: APIError }[],
                entityMap: CreateSubjectsEntityMap
            ) => {
                for (const { input, error } of testCases) {
                    const errors = createSubjects.validate(
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
                cats?: Category[]
            ) => {
                return {
                    organizationId: organization.organization_id,
                    name,
                    categoryIds: cats?.map((c) => c.id),
                }
            }

            it('organization exists', async () => {
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

                const entityManager = await buildEntityMap([], [])
                runTestCases([{ input, error }], entityManager)
            })

            it('category exists', async () => {
                const subject = await createSubject(org)
                const inactiveCat = createCategory()
                inactiveCat.status = Status.INACTIVE
                await inactiveCat.save()

                const input = createSingleInput(org, undefined, [inactiveCat])
                const error = createEntityAPIError(
                    'nonExistent',
                    0,
                    'Category',
                    inactiveCat.id
                )

                const entityMap = await buildEntityMap([subject], [])
                runTestCases([{ input, error }], entityMap)
            })

            it('category exists in org', async () => {
                const subject = await createSubject(org)
                const otherOrg = await createOrganization().save()
                const nonBelongingCat = await createCategory(otherOrg).save()

                const input = createSingleInput(org, undefined, [
                    nonBelongingCat,
                ])

                const error = createEntityAPIError(
                    'nonExistentChild',
                    0,
                    'Category',
                    nonBelongingCat.id,
                    'Organization',
                    org.organization_id
                )

                const entityManager = await buildEntityMap(
                    [subject],
                    [...categories, nonBelongingCat]
                )

                runTestCases([{ input, error }], entityManager)
            })

            it('duplicate name in org', async () => {
                const subjectInSameOrg = createSubject(org)
                subjectInSameOrg.id = uuid_v4()

                const inactiveSubjectInSameOrg = createSubject(org)
                inactiveSubjectInSameOrg.id = uuid_v4()
                inactiveSubjectInSameOrg.status = Status.INACTIVE

                const differentOrg = await createOrganization().save()
                const subjectInDifferentOrg = createSubject(differentOrg)

                const testCases: {
                    input: CreateSubjectInput
                    error?: APIError
                }[] = await Promise.all(
                    [subjectInSameOrg, inactiveSubjectInSameOrg].map(
                        async (s) => {
                            const organization = (await s.organization)!
                            return {
                                input: createSingleInput(organization, s.name!),
                                error: createExistentEntityAttributeAPIError(
                                    'Subject',
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
                        await subjectInDifferentOrg.organization!,
                        subjectInDifferentOrg.name!
                    ),
                })

                const entityMap = await buildEntityMap(
                    [
                        subjectInSameOrg,
                        inactiveSubjectInSameOrg,
                        subjectInDifferentOrg,
                    ],
                    categories
                )

                runTestCases(testCases, entityMap)
            })
        })
    })
})
