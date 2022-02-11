import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { getConnection } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'
import { Category } from '../../src/entities/category'
import { Organization } from '../../src/entities/organization'
import { Status } from '../../src/entities/status'
import { Subject } from '../../src/entities/subject'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    CreateSubjects,
    UpdateSubjects,
    CreateSubjectsEntityMap,
    UpdateSubjectsEntityMap,
    DeleteSubjects,
} from '../../src/resolvers/subject'
import { APIError } from '../../src/types/errors/apiError'
import {
    CreateSubjectInput,
    DeleteSubjectInput,
    SubjectConnectionNode,
    UpdateSubjectInput,
} from '../../src/types/graphQL/subject'
import { mutate } from '../../src/utils/mutations/commonStructure'
import {
    createDuplicateAttributeAPIError,
    createDuplicateInputAttributeAPIError,
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
    createInputLengthAPIError,
    createInputRequiresAtLeastOne,
} from '../../src/utils/resolvers/errors'
import { ObjMap } from '../../src/utils/stringUtils'
import { createCategories, createCategory } from '../factories/category.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createSubject, createSubjects } from '../factories/subject.factory'
import { createUser } from '../factories/user.factory'
import { compareErrors } from '../utils/apiError'
import { userToPayload } from '../utils/operations/userOps'
import { TestConnection } from '../utils/testConnection'

use(deepEqualInAnyOrder)
use(chaiAsPromised)

describe('subject', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
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

    const createCats = async () =>
        await Category.save(createCategories(3, undefined, undefined, true))

    const createSubjectsToUse = async (org: Organization) =>
        await Subject.save(createSubjects(10, org))

    const compareSubjectConnectionNodeWithInput = (
        subject: SubjectConnectionNode,
        input: CreateSubjectInput | UpdateSubjectInput
    ) => {
        expect(subject.name).to.eq(input.name)
        expect(subject.status).to.eq(Status.ACTIVE)
        expect(subject.system).to.equal(false)
    }

    const compareDBSubjectWithInput = async (
        input: CreateSubjectInput | UpdateSubjectInput,
        dbSubject: Subject,
        org: Organization
    ) => {
        expect(dbSubject.name).to.eq(input.name)
        expect(dbSubject.status).to.eq(Status.ACTIVE)
        expect(dbSubject.system).to.eq(false)
        expect((await dbSubject.organization)?.organization_id).to.eq(
            org.organization_id
        )

        const dbSubjectCategoryIds = (await dbSubject.categories)?.map(
            (c) => c.id
        )
        expect(dbSubjectCategoryIds).to.deep.equalInAnyOrder(input.categoryIds)
    }

    const generateExistingSubjects = async (org: Organization) => {
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

        const inactiveOrgSubject = await createSubject(inactiveOrg).save()

        return [
            existingSubject,
            nonPermittedOrgSubject,
            inactiveSubject,
            inactiveOrgSubject,
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

    describe('createSubjects', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let categories: Category[]
        let createSubjects: CreateSubjects

        beforeEach(async () => {
            const data = await createInitialData([
                PermissionName.create_subjects_20227,
            ])
            org = data.organization
            ctx = data.context

            categories = await createCats()
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
                compareSubjectConnectionNodeWithInput(subjects[0], input[0])

                const dbSubjects = await Subject.find()

                expect(dbSubjects).to.have.lengthOf(1)
                await compareDBSubjectWithInput(input[0], dbSubjects[0], org)
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
                const existingSubjects = await generateExistingSubjects(org)
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

    describe('updateSubjects', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let subjectsToEdit: Subject[]
        let categories: Category[]
        let updateSubjects: UpdateSubjects

        beforeEach(async () => {
            const data = await createInitialData([
                PermissionName.edit_subjects_20337,
            ])

            org = data.organization
            ctx = data.context
            categories = await createCats()
            subjectsToEdit = await createSubjectsToUse(org)
            updateSubjects = new UpdateSubjects([], ctx.permissions)
        })

        const buildDefaultInput = (subjects: Subject[]) =>
            Array.from(subjects, ({ id }) => {
                return {
                    id,
                    name: faker.random.word(),
                    categoryIds: categories.map((c) => c.id),
                }
            })

        context('complete mutation calls', () => {
            it('can update a subject', async () => {
                const input: UpdateSubjectInput[] = buildDefaultInput([
                    subjectsToEdit[0],
                ])

                const { subjects } = await mutate(
                    UpdateSubjects,
                    { input },
                    ctx.permissions
                )

                expect(subjects).to.have.lengthOf(1)
                expect(subjects[0].id).to.eq(input[0].id)
                compareSubjectConnectionNodeWithInput(subjects[0], input[0])

                const dbSubjects = await Subject.findByIds([input[0].id])
                expect(dbSubjects).to.have.lengthOf(1)
                await compareDBSubjectWithInput(input[0], dbSubjects[0], org)
            })

            const getDbCallCount = async (input: UpdateSubjectInput[]) => {
                connection.logger.reset()
                await mutate(UpdateSubjects, { input }, ctx.permissions)
                return connection.logger.count
            }

            it('db connections increase in one with number of input elements', async () => {
                const singleSubjectExpectedCalls = 8
                await getDbCallCount(buildDefaultInput(subjectsToEdit)) // warm up permissions cache)

                const singleSubjectCount = await getDbCallCount(
                    buildDefaultInput([subjectsToEdit[0]])
                )

                const twoSubjectCount = await getDbCallCount(
                    buildDefaultInput(subjectsToEdit.slice(0, 2))
                )

                expect(singleSubjectCount).to.be.eq(
                    singleSubjectExpectedCalls,
                    '2 for authorization; 3 for generate maps; 1 for check existence in DB (1 per input element); 2 for save changes'
                )
                expect(twoSubjectCount).to.be.eq(
                    singleSubjectExpectedCalls + 1,
                    '2 for authorization; 3 for generate maps; 2 for check existence in DB (1 per input element); 2 for save changes'
                )
            })
        })

        context('generateEntityMaps', () => {
            it('returns existing conflicting subject names', async () => {
                const existingSubjects = await generateExistingSubjects(org)
                const expectedPairs = await Promise.all(
                    existingSubjects
                        .filter((es) => es.status === Status.ACTIVE)
                        .map(async (es) => {
                            return {
                                id: es.id,
                                organizationId: (await es.organization)
                                    ?.organization_id,
                                name: es.name!,
                            }
                        })
                )

                const input: UpdateSubjectInput[] = [
                    ...expectedPairs.map((ep) => {
                        return {
                            id: ep.id,
                            name: ep.name,
                        }
                    }),
                    {
                        id: subjectsToEdit[0].id,
                        name: faker.random.word(),
                    },
                ]

                const entityMaps = await updateSubjects.generateEntityMaps(
                    input
                )

                expect(
                    Array.from(entityMaps.conflictingNames.keys())
                ).to.deep.equalInAnyOrder(
                    expectedPairs.map((ep) => {
                        return {
                            organizationId: ep.organizationId,
                            name: ep.name,
                        }
                    })
                )
            })
        })

        context('authorize', () => {
            const callAuthorize = async (
                userCtx: { permissions: UserPermissions },
                subjectIds: string[]
            ) => {
                const mutation = new UpdateSubjects([], userCtx.permissions)
                const input = subjectIds.map((subjectId) => {
                    return {
                        id: subjectId,
                        name: faker.random.word(),
                    }
                })

                const maps = await updateSubjects.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            const expectPermissionError = async (
                userCtx: { permissions: UserPermissions },
                subjects: Subject[]
            ) => {
                await expect(
                    callAuthorize(
                        userCtx,
                        subjects.map((s) => s.id)
                    )
                ).to.be.eventually.rejectedWith(
                    /User\(.*\) does not have Permission\(edit_subjects_20337\) in Organizations\(.*\)/
                )
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.edit_subjects_20337
                )

                const permittedSubject = await createSubject(
                    permittedOrg
                ).save()

                await expect(callAuthorize(userCtx, [permittedSubject.id])).to
                    .be.eventually.fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_subjects_20227
                )

                const permittedSubject = await createSubject(
                    permittedOrg
                ).save()

                await expectPermissionError(userCtx, [permittedSubject])
            })

            it('checks all organizations', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.edit_subjects_20337
                )

                const permittedSubject = await createSubject(
                    permittedOrg
                ).save()

                const {
                    permittedOrg: notPermittedOrg,
                } = await makeUserWithPermission(
                    PermissionName.create_subjects_20227
                )

                const notPermittedSubject = await createSubject(
                    notPermittedOrg
                ).save()

                await expectPermissionError(userCtx, [
                    permittedSubject,
                    notPermittedSubject,
                ])
            })
        })

        const buildEntityMap = async (
            subjects: Subject[],
            cats: Category[]
        ) => {
            const entityMap: UpdateSubjectsEntityMap = {
                mainEntity: new Map([]),
                categories: new Map([]),
                conflictingNames: new ObjMap([]),
            }

            for (const subject of subjects) {
                if (subject.id === undefined) {
                    subject.id = uuid_v4()
                }

                entityMap.mainEntity.set(subject.id, subject)

                const subjectOrg = (await subject.organization)!
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
            let inputs: UpdateSubjectInput[]

            const expectInputsValidation = async (error: APIError) => {
                const maps = await buildEntityMap(
                    subjectsToEdit.slice(0, 3),
                    categories
                )

                const {
                    validInputs,
                    apiErrors,
                } = updateSubjects.validationOverAllInputs(inputs, maps)

                expect(validInputs.length).to.eq(2)
                expect(validInputs[0].input.id).to.eq(inputs[0].id)
                expect(validInputs[0].index).to.eq(0)
                expect(validInputs[1].input.id).to.eq(inputs[2].id)
                expect(validInputs[1].index).to.eq(2)
                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], error)
            }

            beforeEach(() => {
                inputs = buildDefaultInput(subjectsToEdit.slice(0, 3))
            })

            it('at least one', async () => {
                const incompleteInput = inputs[1]
                incompleteInput.name = undefined
                incompleteInput.categoryIds = undefined
                const error = createInputRequiresAtLeastOne(1, 'Subject', [
                    'name',
                    'categoryIds',
                ])

                await expectInputsValidation(error)
            })

            it('input duplicates', async () => {
                const duplicateInput = inputs[1]
                duplicateInput.id = inputs[0].id
                const error = createDuplicateAttributeAPIError(
                    1,
                    ['id'],
                    'subject'
                )

                await expectInputsValidation(error)
            })

            it('duplicate names in org', async () => {
                const duplicateInput = inputs[1]
                duplicateInput.name = inputs[0].name
                const error = createDuplicateInputAttributeAPIError(
                    1,
                    'Subject',
                    org.organization_id,
                    'name',
                    duplicateInput.name!
                )

                await expectInputsValidation(error)
            })

            it('subItemsLength', async () => {
                const wrongSubItemsLengthInput = inputs[1]
                wrongSubItemsLengthInput.categoryIds = []
                const error = createInputLengthAPIError(
                    'UpdateSubjectInput',
                    'min',
                    'categoryIds',
                    1
                )

                await expectInputsValidation(error)
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
                    'UpdateSubjectInput'
                )

                await expectInputsValidation(error)
            })
        })

        context('validate', () => {
            const runTestCases = (
                testCases: { input: UpdateSubjectInput; error?: APIError }[],
                entityMap: UpdateSubjectsEntityMap
            ) => {
                for (const { input, error } of testCases) {
                    const subject = entityMap.mainEntity.get(input.id)!
                    const errors = updateSubjects.validate(
                        0,
                        subject,
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
                subject: Subject,
                name = faker.random.word(),
                cats?: Category[]
            ) => {
                return {
                    id: subject.id,
                    name,
                    categoryIds: cats?.map((c) => c.id),
                }
            }

            it('subject exists', async () => {
                const inactiveSubject = createSubject(org)
                inactiveSubject.status = Status.INACTIVE
                await inactiveSubject.save()

                const input = createSingleInput(inactiveSubject)
                const error = createEntityAPIError(
                    'nonExistent',
                    0,
                    'Subject',
                    inactiveSubject.id
                )

                const entityManager = await buildEntityMap([], [])
                runTestCases([{ input, error }], entityManager)
            })

            it('category exists', async () => {
                const subject = subjectsToEdit[0]
                const inactiveCat = createCategory()
                inactiveCat.status = Status.INACTIVE
                await inactiveCat.save()
                const input = createSingleInput(subject, undefined, [
                    inactiveCat,
                ])

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
                const subject = subjectsToEdit[0]
                const otherOrg = await createOrganization().save()
                const nonBelongingCat = await createCategory(otherOrg).save()
                const input = createSingleInput(subject, undefined, [
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
                    input: UpdateSubjectInput
                    error?: APIError
                }[] = await Promise.all(
                    [subjectInSameOrg, inactiveSubjectInSameOrg].map(
                        async (s) => {
                            return {
                                input: {
                                    id: s.id,
                                    name: s.name!,
                                },
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
                        subjectInDifferentOrg,
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

    describe('deleteSubjects', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let subjectsToDelete: Subject[]
        let deleteSubjects: DeleteSubjects

        beforeEach(async () => {
            const data = await createInitialData([
                PermissionName.delete_subjects_20447,
            ])

            org = data.organization
            ctx = data.context
            subjectsToDelete = await createSubjectsToUse(org)
            deleteSubjects = new DeleteSubjects([], ctx.permissions)
        })

        const buildDefaultInput = (subjects: Subject[]): DeleteSubjectInput[] =>
            Array.from(subjects, ({ id }) => {
                return { id }
            })

        context('complete mutation calls', () => {
            it('can delete a subject', async () => {
                const input = buildDefaultInput([subjectsToDelete[0]])
                const { subjects } = await mutate(
                    DeleteSubjects,
                    { input },
                    ctx.permissions
                )

                expect(subjects).to.have.lengthOf(1)
                expect(subjects[0].id).to.eq(input[0].id)
                expect(subjects[0].status).to.eq(Status.INACTIVE)

                const dbSubjects = await Subject.findByIds([input[0].id])
                expect(dbSubjects).to.have.lengthOf(1)
                expect(dbSubjects[0].status).to.eq(Status.INACTIVE)
            })

            const getDbCallCount = async (input: DeleteSubjectInput[]) => {
                connection.logger.reset()
                await mutate(DeleteSubjects, { input }, ctx.permissions)
                return connection.logger.count
            }

            it('makes the same number of db connections regardless of input length', async () => {
                await getDbCallCount(buildDefaultInput([subjectsToDelete[0]])) // warm up permissions cache)

                const singleSubjectCount = await getDbCallCount(
                    buildDefaultInput([subjectsToDelete[1]])
                )

                const twoSubjectCount = await getDbCallCount(
                    buildDefaultInput(subjectsToDelete.slice(2, 4))
                )

                expect(twoSubjectCount).to.be.eq(singleSubjectCount)
                expect(twoSubjectCount).to.be.equal(2)
            })
        })

        context('authorize', () => {
            const callAuthorize = async (
                userCtx: { permissions: UserPermissions },
                subjects: Subject[]
            ) => {
                const mutation = new DeleteSubjects([], userCtx.permissions)
                const input = buildDefaultInput(subjects)
                const maps = await deleteSubjects.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            const expectPermissionError = async (
                userCtx: { permissions: UserPermissions },
                subjects: Subject[]
            ) => {
                await expect(
                    callAuthorize(userCtx, subjects)
                ).to.be.eventually.rejectedWith(
                    /User\(.*\) does not have Permission\(delete_subjects_20447\) in Organizations\(.*\)/
                )
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.delete_subjects_20447
                )

                const permittedSubject = await createSubject(
                    permittedOrg
                ).save()

                await expect(callAuthorize(userCtx, [permittedSubject])).to.be
                    .eventually.fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_subjects_20227
                )

                const permittedSubject = await createSubject(
                    permittedOrg
                ).save()

                await expectPermissionError(userCtx, [permittedSubject])
            })

            it('checks all organizations', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.delete_subjects_20447
                )

                const permittedSubject = await createSubject(
                    permittedOrg
                ).save()

                const {
                    permittedOrg: notPermittedOrg,
                } = await makeUserWithPermission(
                    PermissionName.create_subjects_20227
                )

                const notPermittedSubject = await createSubject(
                    notPermittedOrg
                ).save()

                await expectPermissionError(userCtx, [
                    permittedSubject,
                    notPermittedSubject,
                ])
            })
        })
    })
})
