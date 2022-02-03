import { expect, use } from 'chai'
import faker from 'faker'
import { getManager, In } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'
import { Model } from '../../src/model'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { AgeRange } from '../../src/entities/ageRange'
import { Grade } from '../../src/entities/grade'
import { Class } from '../../src/entities/class'
import { Subject } from '../../src/entities/subject'
import { Status } from '../../src/entities/status'
import {
    addSchoolToClass,
    addStudentToClass,
    addTeacherToClass,
    editTeachersInClass,
    editStudentsInClass,
    editSchoolsInClass,
    editAgeRanges,
    editGrades,
    editSubjects,
    editPrograms,
    updateClass,
    deleteClass,
    listPrograms,
    listAgeRanges,
    listGrades,
    listSubjects,
    removeTeacherInClass,
    removeSchoolFromClass,
    removeStudentInClass,
    eligibleTeachers,
    eligibleStudents,
} from '../utils/operations/classOps'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../utils/operations/userOps'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import { Organization } from '../../src/entities/organization'
import { Program } from '../../src/entities/program'
import { User } from '../../src/entities/user'
import {
    AddProgramsToClasses,
    deleteClasses as deleteClassesResolver,
    RemoveProgramsFromClasses,
    CreateClasses,
    EntityMapCreateClass,
    UpdateClasses,
    UpdateClassEntityMap,
    AddStudentsToClasses,
    AddStudentsClassesEntityMap,
    RemoveStudentsFromClasses,
    AddTeachersToClasses,
    AddTeachersClassesEntityMap,
    RemoveTeachersFromClasses,
    RemoveStudentsClassesEntityMap,
    RemoveTeachersClassesEntityMap,
} from '../../src/resolvers/class'
import {
    addUserToOrganizationAndValidate,
    createClass,
    createRole,
    createSchool,
} from '../utils/operations/organizationOps'
import { School } from '../../src/entities/school'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import {
    getNonAdminAuthToken,
    getAdminAuthToken,
    generateToken,
} from '../utils/testConfig'
import { addRoleToOrganizationMembership } from '../utils/operations/organizationMembershipOps'
import { denyPermission, grantPermission } from '../utils/operations/roleOps'
import { PermissionName } from '../../src/permissions/permissionNames'
import chaiAsPromised from 'chai-as-promised'
import { addRoleToSchoolMembership } from '../utils/operations/schoolMembershipOps'
import { addUserToSchool } from '../utils/operations/schoolOps'
import { createUserAndValidate } from '../utils/operations/modelOps'
import { createOrganization } from '../factories/organization.factory'
import {
    createUser,
    createAdminUser as adminUserFactory,
    createUsers,
} from '../factories/user.factory'
import {
    createClass as createClassFactory,
    createClasses,
    createClasses as createClassesFactory,
} from '../factories/class.factory'
import { createRole as createRoleFactory } from '../factories/role.factory'
import { createAgeRange } from '../factories/ageRange.factory'
import { createGrade } from '../factories/grade.factory'
import { createSubject } from '../factories/subject.factory'
import { createProgram, createPrograms } from '../factories/program.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { Role } from '../../src/entities/role'
import {
    AddProgramsToClassInput,
    DeleteClassInput,
    CreateClassInput,
    RemoveProgramsFromClassInput,
    UpdateClassInput,
    AddStudentsToClassInput,
    ClassesMutationResult,
    RemoveStudentsFromClassInput,
    AddTeachersToClassInput,
    RemoveTeachersFromClassInput,
} from '../../src/types/graphQL/class'
import {
    compareErrors,
    checkNotFoundErrors,
    expectAPIError,
    expectAPIErrorCollection,
    compareMultipleErrors,
} from '../utils/apiError'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { mutate } from '../../src/utils/mutations/commonStructure'
import { buildPermissionError, permErrorMeta } from '../utils/errors'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { APIError, APIErrorCollection } from '../../src/types/errors/apiError'
import {
    createDuplicateChildEntityAttributeAPIError,
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createDuplicateInputAttributeAPIError,
    createInputLengthAPIError,
} from '../../src/utils/resolvers/errors'
import { NIL_UUID } from '../utils/database'
import { generateShortCode, validateShortCode } from '../../src/utils/shortcode'
import { customErrors } from '../../src/types/errors/customError'
import { ObjMap } from '../../src/utils/stringUtils'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { mapClassToClassConnectionNode } from '../../src/pagination/classesConnection'
import { config } from '../../src/config/config'

type ClassSpecs = {
    class: Class
    progsToRemove: Program[]
    progsToKeep: Program[]
}
interface OrgsData {
    org: Organization
    classes: ClassSpecs[]
    programs: Program[]
}

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('class', () => {
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

    describe('createClasses', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let createClasses: CreateClasses

        beforeEach(async () => {
            const clientUser = await createUser().save()
            org = await createOrganization().save()
            const r = await createRoleFactory(undefined, org, {
                permissions: [PermissionName.create_class_20224],
            }).save()
            await createOrganizationMembership({
                user: clientUser,
                organization: org,
                roles: [r],
            }).save()
            const permissions = new UserPermissions(userToPayload(clientUser))
            ctx = { permissions }
            createClasses = new CreateClasses([], ctx.permissions)
        })

        context('complete mutation calls', () => {
            it('can create a class', async () => {
                const input: CreateClassInput[] = [
                    {
                        organizationId: org.organization_id,
                        name: faker.random.word(),
                    },
                ]

                const result = await mutate(
                    CreateClasses,
                    { input },
                    ctx.permissions
                )
                expect(result.classes.length).to.eq(1)

                expect(result.classes[0].id).to.not.be.undefined
                expect(result.classes[0].name).to.eq(input[0].name)
                expect(result.classes[0].status).to.eq(Status.ACTIVE)
                expect(result.classes[0].shortCode).to.not.be.undefined

                const dbClasses = await Class.find()

                expect(dbClasses).to.have.lengthOf(1)

                expect(dbClasses[0].status).to.eq(Status.ACTIVE)
                expect(dbClasses[0].class_name).to.eq(input[0].name)
                expect(dbClasses[0]?.shortcode).to.eq(
                    result.classes[0].shortCode
                )
                expect(
                    (await dbClasses[0].organization)?.organization_id
                ).to.eq(org.organization_id)
            })

            const getDbCallCount = async (input: CreateClassInput[]) => {
                connection.logger.reset()
                await mutate(CreateClasses, { input }, ctx.permissions)
                return connection.logger.count
            }

            const inputElement = () => {
                return {
                    organizationId: org.organization_id,
                    name: faker.random.word(),
                }
            }

            it('db connections do not increase with number of input elements', async () => {
                await getDbCallCount([inputElement()]) // warm up permissions cache
                const singleClassCount = await getDbCallCount([inputElement()])
                const twoClassCount = await getDbCallCount([
                    inputElement(),
                    inputElement(),
                ])
                expect(twoClassCount).to.be.eq(singleClassCount)
                expect(twoClassCount).to.be.equal(5)
            })
        })

        context('normalize', () => {
            it('preserves input element positions and length', () => {
                for (const inputLength of [0, 1, 2, 5]) {
                    const input: CreateClassInput[] = Array.from(
                        Array(inputLength)
                    ).map(() => {
                        return {
                            organizationId: uuid_v4(),
                            name: faker.random.word(),
                            shortcode: generateShortCode(),
                        }
                    })

                    const normalized = createClasses.normalize(input)
                    expect(normalized.length).to.eq(input.length)
                    expect(
                        normalized.map((n) => n.organizationId)
                    ).to.deep.equal(input.map((i) => i.organizationId))
                    expect(normalized.map((n) => n.name)).to.deep.equal(
                        input.map((i) => i.name)
                    )
                    expect(normalized.map((n) => n.shortcode)).to.deep.equal(
                        input.map((i) => i.shortcode)
                    )
                }
            })

            context('shortcodes', () => {
                const checkShortcode = (
                    shortcode: string | undefined
                ): string | undefined => {
                    const input: CreateClassInput[] = [
                        {
                            organizationId: org.organization_id,
                            name: faker.random.word(),
                            shortcode,
                        },
                    ]

                    const normalized = createClasses.normalize(input)
                    expect(normalized.length).to.eq(input.length)
                    return normalized[0].shortcode
                }

                it('generates shortcodes when not supplied by caller', () => {
                    const normalizedShortcode = checkShortcode(undefined)
                    expect(normalizedShortcode).to.not.be.undefined
                    expect(validateShortCode(normalizedShortcode)).to.be.true
                })

                it('normalizes shortcodes to uppercase', () => {
                    const invalidShortcode = generateShortCode().toLowerCase()
                    expect(validateShortCode(invalidShortcode)).to.be.false

                    const normalizedShortcode = checkShortcode(invalidShortcode)
                    expect(normalizedShortcode).to.eq(
                        invalidShortcode.toUpperCase()
                    )
                })

                it('preserves invalid shortcodes', () => {
                    const invalidShortcode = '!!!!!'
                    expect(validateShortCode(invalidShortcode)).to.be.false

                    const normalizedShortcode = checkShortcode(invalidShortcode)
                    expect(normalizedShortcode).to.eq(invalidShortcode)
                })

                it('preserves valid shortcodes', () => {
                    const validShortcode = generateShortCode()
                    const normalizedShortcode = checkShortcode(validShortcode)
                    expect(normalizedShortcode).to.eq(validShortcode)
                })
            })
        })

        context('generateEntityMaps', () => {
            it('returns existing organizations', async () => {
                const unpermittedOrg = await createOrganization().save()

                const validOrgIds = [
                    org.organization_id,
                    // entity maps are generated before authorization
                    // so we should fetch orgs regardless of permissions
                    unpermittedOrg.organization_id,
                ]

                const inactiveOrg = createOrganization()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()

                const invalidOrgIds = [
                    // we shouldn't error here for invalid org IDs
                    // that is handled later by validation
                    uuid_v4(),
                    // if an organization isn't active we should act like
                    // it doesn't exist at all
                    inactiveOrg.organization_id,
                ]

                const input: CreateClassInput[] = [
                    ...validOrgIds,
                    ...invalidOrgIds,
                ].map((organizationId) => {
                    return {
                        organizationId: organizationId,
                        name: faker.random.word(),
                    }
                })

                const entityMaps = await createClasses.generateEntityMaps(input)
                expect(
                    Array.from(entityMaps.organizations.keys())
                ).to.deep.equalInAnyOrder(validOrgIds)
                expect(
                    Array.from(entityMaps.organizations.values()).map(
                        (i) => i.organization_id
                    )
                ).to.deep.equalInAnyOrder(validOrgIds)
                for (const [
                    key,
                    organization,
                ] of entityMaps.organizations.entries()) {
                    expect(key).to.eq(organization.organization_id)
                }
            })

            it('returns conflicting orgId-className pairs', async () => {
                const existingClass = await createClassFactory(
                    undefined,
                    org
                ).save()

                const unpermittedOrgClass = await createClassFactory(
                    undefined,
                    await createOrganization().save()
                ).save()

                const inactiveClass = createClassFactory(undefined, org)
                inactiveClass.status = Status.INACTIVE
                await inactiveClass.save()

                const inactiveOrg = createOrganization()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()

                const inactiveOrgClass = await createClassFactory(
                    undefined,
                    inactiveOrg
                ).save()

                const existingClasses = [
                    existingClass,
                    unpermittedOrgClass,
                    inactiveClass,
                    inactiveOrgClass,
                ]

                const expectedPairs = await Promise.all(
                    existingClasses.map(async (ec) => {
                        return {
                            organizationId: (await ec.organization)!
                                .organization_id,
                            name: ec.class_name!,
                        }
                    })
                )

                const input: CreateClassInput[] = [
                    ...expectedPairs,
                    {
                        organizationId: org.organization_id,
                        name: faker.random.word(),
                    },
                ]

                const entityMaps = await createClasses.generateEntityMaps(input)
                expect(
                    Array.from(entityMaps.conflictingNames.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
            })

            it('returns conflicting orgId-shortcode pairs', async () => {
                const existingClass = await createClassFactory(
                    undefined,
                    org
                ).save()

                const unpermittedOrgClass = await createClassFactory(
                    undefined,
                    await createOrganization().save()
                ).save()

                const inactiveClass = createClassFactory(undefined, org)
                inactiveClass.status = Status.INACTIVE
                await inactiveClass.save()

                const inactiveOrg = createOrganization()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()

                const inactiveOrgClass = await createClassFactory(
                    undefined,
                    inactiveOrg
                ).save()

                const existingClasses = [
                    existingClass,
                    unpermittedOrgClass,
                    inactiveClass,
                    inactiveOrgClass,
                ]

                const expectedPairs = await Promise.all(
                    existingClasses.map(async (ec) => {
                        return {
                            organizationId: (await ec.organization)!
                                .organization_id,
                            name: ec.class_name!,
                            shortcode: ec.shortcode!,
                        }
                    })
                )

                const input: CreateClassInput[] = [
                    ...expectedPairs,
                    {
                        organizationId: org.organization_id,
                        name: faker.random.word(),
                        shortcode: generateShortCode(),
                    },
                ]

                const expectedEntries = await Promise.all(
                    existingClasses.map(async (ec) => {
                        return [
                            {
                                organizationId: (await ec.organization)!
                                    .organization_id,
                                shortcode: ec.shortcode!,
                            },
                            ec.class_id,
                        ]
                    })
                )

                const entityMaps = await createClasses.generateEntityMaps(input)
                expect(
                    Array.from(entityMaps.conflictingShortcodes.entries())
                ).to.deep.equalInAnyOrder(expectedEntries)
            })
        })

        context('authorize', () => {
            const makeUserWithPermission = async (
                permission: PermissionName
            ) => {
                const clientUser = await createUser().save()
                const permittedOrg = await createOrganization().save()
                const role = await createRoleFactory(undefined, permittedOrg, {
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
                userCtx: {
                    permissions: UserPermissions
                },
                orgIds: string[]
            ) => {
                const mutation = new CreateClasses([], userCtx.permissions)

                const input = orgIds.map((orgId) => {
                    return {
                        organizationId: orgId,
                        name: faker.random.word(),
                    }
                })

                return mutation.authorize(input)
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_class_20224
                )

                await expect(
                    callAuthorize(userCtx, [permittedOrg.organization_id])
                ).to.be.eventually.fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.edit_class_20334
                )

                await expect(
                    callAuthorize(userCtx, [permittedOrg.organization_id])
                ).to.be.eventually.rejectedWith(
                    /User\(.*\) does not have Permission\(create_class_20224\) in Organizations\(.*\)/
                )
            })

            it('checks all organizations', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_class_20224
                )

                const {
                    permittedOrg: notPermittedOrg,
                } = await makeUserWithPermission(
                    PermissionName.edit_class_20334
                )

                await expect(
                    callAuthorize(userCtx, [
                        permittedOrg.organization_id,
                        notPermittedOrg.organization_id,
                    ])
                ).to.be.eventually.rejectedWith(
                    /User\(.*\) does not have Permission\(create_class_20224\) in Organizations\(.*\)/
                )
            })
        })

        const buildEntityMap = async (classes: Class[]) => {
            const entityMap: EntityMapCreateClass = {
                organizations: new Map([]),
                conflictingNames: new ObjMap([]),
                conflictingShortcodes: new ObjMap([]),
            }

            for (const _class of classes) {
                if (_class.class_id === undefined) {
                    _class.class_id = uuid_v4()
                }
                const classOrg = (await _class.organization)!
                entityMap.organizations.set(classOrg.organization_id, classOrg)
                entityMap.conflictingNames.set(
                    {
                        organizationId: classOrg.organization_id,
                        name: _class.class_name!,
                    },
                    _class.class_id
                )
                entityMap.conflictingShortcodes.set(
                    {
                        organizationId: classOrg.organization_id,
                        shortcode: _class.shortcode!,
                    },
                    _class.class_id
                )
            }
            return entityMap
        }

        context('validationOverAllInputs', () => {
            let inputs: CreateClassInput[]

            beforeEach(() => {
                inputs = [
                    {
                        organizationId: org.organization_id,
                        name: faker.random.word(),
                        shortcode: generateShortCode(),
                    },
                    {
                        organizationId: org.organization_id,
                        name: faker.random.word(),
                        shortcode: generateShortCode(),
                    },
                    {
                        organizationId: org.organization_id,
                        name: faker.random.word(),
                        shortcode: generateShortCode(),
                    },
                ]
            })

            it('duplicate names', async () => {
                const duplicateInput = inputs[1]

                duplicateInput.name = inputs[0].name

                const {
                    validInputs,
                    apiErrors,
                } = createClasses.validationOverAllInputs(inputs)

                expect(validInputs.length).to.eq(2)
                expect(validInputs[0].input.name).to.eq(inputs[0].name)
                expect(validInputs[0].index).to.eq(0)
                expect(validInputs[1].input.name).to.eq(inputs[2].name)
                expect(validInputs[1].index).to.eq(2)

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['name'],
                    'class'
                )

                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], error)
            })

            it('duplicate shortcodes', async () => {
                const duplicateInput = inputs[1]

                duplicateInput.shortcode = inputs[0].shortcode

                const {
                    validInputs,
                    apiErrors,
                } = createClasses.validationOverAllInputs(inputs)

                expect(validInputs.length).to.eq(2)
                expect(validInputs[0].input).to.deep.eq(inputs[0])
                expect(validInputs[0].index).to.eq(0)
                expect(validInputs[1].input).to.deep.eq(inputs[2])
                expect(validInputs[1].index).to.eq(2)

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['shortcode'],
                    'class'
                )

                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], error)
            })
        })

        context('validate', () => {
            const runTestCases = (
                testCases: { input: CreateClassInput; error?: APIError }[],
                entityMap: EntityMapCreateClass
            ) => {
                for (const { input, error } of testCases) {
                    const errors = createClasses.validate(
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

            it('returns errors for invalid shortcodes', async () => {
                const input: CreateClassInput = {
                    organizationId: org.organization_id,
                    name: faker.random.word(),
                    shortcode: '!!!!!',
                }
                const error = new APIError({
                    code: customErrors.invalid_alphanumeric.code,
                    message: customErrors.invalid_alphanumeric.message,
                    variables: [],
                    entity: 'Class',
                    attribute: 'shortcode',
                    index: 0,
                })
                const entityMap = await buildEntityMap([])
                entityMap.organizations.set(org.organization_id, org)

                runTestCases([{ input, error }], entityMap)
            })

            it('organization exists', async () => {
                // completly made up org IDs will fail before validation at authorize checks
                // because you can't have permissions for a non-existant org
                // but inactive orgs can pass authorize checks
                const inactiveOrg = createOrganization()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()

                const input = {
                    organizationId: inactiveOrg.organization_id,
                    name: faker.random.word(),
                }

                const error = new APIError({
                    code: customErrors.nonexistent_or_inactive.code,
                    message: customErrors.nonexistent_or_inactive.message,
                    variables: [],
                    entity: 'Organization',
                    attribute: 'ID',
                    otherAttribute: inactiveOrg.organization_id,
                    index: 0,
                })

                const entityManager = await buildEntityMap([])

                runTestCases([{ input, error }], entityManager)
            })

            it('duplicate name in org', async () => {
                const classInSameOrg = createClassFactory(undefined, org)
                classInSameOrg.class_id = uuid_v4()
                const inactiveClassInSameOrg = createClassFactory(
                    undefined,
                    org
                )
                inactiveClassInSameOrg.class_id = uuid_v4()
                inactiveClassInSameOrg.status = Status.INACTIVE

                const differentOrg = await createOrganization().save()
                const classInDifferentOrg = createClassFactory(
                    undefined,
                    differentOrg
                )

                const testCases: {
                    input: CreateClassInput
                    error?: APIError
                }[] = await Promise.all(
                    [classInSameOrg, inactiveClassInSameOrg].map(async (c) => {
                        const organizationId = (await c.organization)!
                            .organization_id
                        return {
                            input: {
                                name: c.class_name!,
                                organizationId,
                            },
                            error: createDuplicateChildEntityAttributeAPIError(
                                'Class',
                                c.class_id,
                                'Organization',
                                organizationId,
                                'name',
                                c.class_name!,
                                0
                            ),
                        }
                    })
                )
                testCases.push({
                    input: {
                        name: classInDifferentOrg.class_name!,
                        organizationId: (await classInDifferentOrg.organization)!
                            .organization_id,
                    },
                })

                const entityMap = await buildEntityMap([
                    classInSameOrg,
                    inactiveClassInSameOrg,
                    classInDifferentOrg,
                ])

                runTestCases(testCases, entityMap)
            })

            it('duplicate shortcode in org', async () => {
                const classInSameOrg = createClassFactory(undefined, org)
                classInSameOrg.class_id = uuid_v4()
                const inactiveClassInSameOrg = createClassFactory(
                    undefined,
                    org
                )
                inactiveClassInSameOrg.status = Status.INACTIVE
                inactiveClassInSameOrg.class_id = uuid_v4()
                const differentOrg = await createOrganization().save()
                const classInDifferentOrg = createClassFactory(
                    undefined,
                    differentOrg
                )
                classInDifferentOrg.class_id = uuid_v4()

                const testCases: {
                    input: Partial<CreateClassInput>
                    error: APIError
                }[] = await Promise.all(
                    [classInSameOrg, inactiveClassInSameOrg].map(async (c) => {
                        return {
                            input: {
                                organizationId: (await c.organization)!
                                    .organization_id,
                                shortcode: c.shortcode!,
                            },
                            error: createDuplicateChildEntityAttributeAPIError(
                                'Class',
                                c.class_id,
                                'Organization',
                                (await c.organization)!.organization_id,
                                'shortcode',
                                c.shortcode!,
                                0
                            ),
                        }
                    })
                )

                const entityMap = await buildEntityMap([
                    classInSameOrg,
                    inactiveClassInSameOrg,
                    classInDifferentOrg,
                ])

                runTestCases(
                    testCases.map((t) => {
                        ;(t.input as Partial<CreateClassInput>).name = faker.random.word()
                        return t as {
                            input: CreateClassInput
                            error: APIError
                        }
                    }),
                    entityMap
                )
            })
        })

        it('process', async () => {
            const input: CreateClassInput = {
                organizationId: org.organization_id,
                name: faker.random.word(),
                shortcode: generateShortCode(),
            }
            const entityMap = await buildEntityMap([])
            entityMap.organizations.set(org.organization_id, org)

            const {
                outputEntity,
            }: {
                outputEntity: Class
            } = createClasses.process(input, entityMap)
            expect(outputEntity.class_name).to.eq(input.name)
            expect(outputEntity.shortcode).to.eq(input.shortcode)
            expect((await outputEntity.organization)?.organization_id).to.eq(
                input.organizationId
            )
        })
    })

    describe('set', () => {
        context('when not authenticated', () => {
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const editClassRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    editClassRole.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    editClassRole.role_id
                )
            })

            it('the class status by default is active', async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
            })

            it('should throw a permission exception and not mutate the database entry', async () => {
                const newClassName = 'New Class Name'
                const originalClassName = cls.class_name
                await expect(
                    updateClass(testClient, cls.class_id, newClassName, {
                        authorization: undefined,
                    })
                ).to.be.rejected
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.class_name).to.equal(originalClassName)
            })
        })

        context('when not authorized within organization', () => {
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('the class status by default is active', async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
            })

            it('should throw a permission exception and not mutate the database entry', async () => {
                const newClassName = 'New Class Name'
                const originalClassName = cls.class_name
                await expect(
                    updateClass(testClient, cls.class_id, newClassName, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.class_name).to.equal(originalClassName)
            })
        })

        context('when authorized within organization', () => {
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const editClassRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    editClassRole.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    editClassRole.role_id
                )
            })

            it('the class status by default is active', async () => {
                expect(cls.status).to.eq(Status.ACTIVE)
            })

            it('should update class name', async () => {
                const newClassName = 'New Class Name'
                const gqlClass = await updateClass(
                    testClient,
                    cls.class_id,
                    newClassName,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlClass).to.exist
                expect(gqlClass.class_name).to.equal(newClassName)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.class_name).to.equal(newClassName)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not update the class name', async () => {
                    const newClassName = 'New Class Name'
                    const originalClassName = cls.class_name
                    const gqlClass = await updateClass(
                        testClient,
                        cls.class_id,
                        newClassName,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlClass).to.be.null
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    expect(dbClass.class_name).to.equal(originalClassName)
                })
            })
        })
    })

    describe('eligibleTeachers', () => {
        context(
            'when one user is authorized to attend a live class as a teacher, and another as a student',
            () => {
                let teacherId: string
                let studentId: string
                let teacherRoleId: string
                let studentRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const teacherInfo = { email: 'teacher@gmail.com' } as User
                    const studentInfo = { email: 'student@gmail.com' } as User
                    teacherId = (
                        await createUserAndValidate(testClient, teacherInfo)
                    )?.user_id
                    studentId = (
                        await createUserAndValidate(testClient, studentInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teacherId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        studentId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    teacherRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Teacher Role'
                        )
                    )?.role_id
                    studentRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Student Role'
                        )
                    )?.role_id
                    await grantPermission(
                        testClient,
                        teacherRoleId,
                        PermissionName.attend_live_class_as_a_teacher_186,
                        { authorization: orgOwnerToken }
                    )
                    await grantPermission(
                        testClient,
                        studentRoleId,
                        PermissionName.attend_live_class_as_a_student_187,
                        { authorization: orgOwnerToken }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        teacherId,
                        organizationId,
                        teacherRoleId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        studentId,
                        organizationId,
                        studentRoleId
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            teacherId,
                            organizationId,
                            teacherRoleId
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            studentId,
                            organizationId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing the teacher', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(teacherId)
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, teacherId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addUserToSchool(testClient, studentId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            teacherId,
                            schoolId,
                            teacherRoleId
                        )
                        await addRoleToSchoolMembership(
                            testClient,
                            studentId,
                            schoolId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing the teacher', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(teacherId)
                    })
                })
            }
        )

        context(
            "when a user's permission to attend a live class as a teacher has been denied (permission.allow = false)",
            () => {
                let teacherId: string
                let teacherRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const teacherInfo = { email: 'teacher@gmail.com' } as User
                    teacherId = (
                        await createUserAndValidate(testClient, teacherInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teacherId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    teacherRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Teacher Role'
                        )
                    )?.role_id
                    await denyPermission(
                        testClient,
                        teacherRoleId,
                        PermissionName.attend_live_class_as_a_teacher_186,
                        { authorization: orgOwnerToken }
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            teacherId,
                            organizationId,
                            teacherRoleId
                        )
                    })

                    it('returns an array containing only the organization owner', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, teacherId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            teacherId,
                            schoolId,
                            teacherRoleId
                        )
                    })

                    it('returns an array containing only the organization owner', async () => {
                        const gqlTeachers = await eligibleTeachers(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlTeachers
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })
            }
        )
    })

    describe('eligibleStudents', () => {
        context(
            'when one user is authorized to attend a live class as a teacher, and another as a student',
            () => {
                let teacherId: string
                let studentId: string
                let teacherRoleId: string
                let studentRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const teacherInfo = { email: 'teacher@gmail.com' } as User
                    const studentInfo = { email: 'student@gmail.com' } as User
                    teacherId = (
                        await createUserAndValidate(testClient, teacherInfo)
                    )?.user_id
                    studentId = (
                        await createUserAndValidate(testClient, studentInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teacherId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        studentId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    teacherRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Teacher Role'
                        )
                    )?.role_id
                    studentRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Student Role'
                        )
                    )?.role_id
                    await grantPermission(
                        testClient,
                        teacherRoleId,
                        PermissionName.attend_live_class_as_a_teacher_186,
                        { authorization: orgOwnerToken }
                    )
                    await grantPermission(
                        testClient,
                        studentRoleId,
                        PermissionName.attend_live_class_as_a_student_187,
                        { authorization: orgOwnerToken }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        teacherId,
                        organizationId,
                        teacherRoleId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        studentId,
                        organizationId,
                        studentRoleId
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            teacherId,
                            organizationId,
                            teacherRoleId
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            studentId,
                            organizationId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing only the student', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(studentId)
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, teacherId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addUserToSchool(testClient, studentId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            teacherId,
                            schoolId,
                            teacherRoleId
                        )
                        await addRoleToSchoolMembership(
                            testClient,
                            studentId,
                            schoolId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing the organization owner and the student', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').with.lengthOf(1)
                        expect(userIds[0]).to.equal(studentId)
                    })
                })
            }
        )

        context(
            "when a user's permission to attend a live class as a student has been denied (permission.allow = false)",
            () => {
                let studentId: string
                let studentRoleId: string
                let classId: string
                let organizationId: string
                let orgOwnerId: string
                let orgOwnerToken: string
                let arbitraryUserToken: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    orgOwnerId = orgOwner?.user_id
                    orgOwnerToken = generateToken(userToPayload(orgOwner))
                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                    const studentInfo = { email: 'student@gmail.com' } as User
                    studentId = (
                        await createUserAndValidate(testClient, studentInfo)
                    )?.user_id
                    organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwnerId
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        studentId,
                        organizationId,
                        { authorization: orgOwnerToken }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    studentRoleId = (
                        await createRole(
                            testClient,
                            organizationId,
                            'Student Role'
                        )
                    )?.role_id
                    await denyPermission(
                        testClient,
                        studentRoleId,
                        PermissionName.attend_live_class_as_a_student_187,
                        { authorization: orgOwnerToken }
                    )
                })

                context('via organization permission', () => {
                    beforeEach(async () => {
                        await addRoleToOrganizationMembership(
                            testClient,
                            studentId,
                            organizationId,
                            studentRoleId
                        )
                    })

                    it('returns an array containing only the organization owner', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })

                context('via school permission', () => {
                    beforeEach(async () => {
                        const schoolId = (
                            await createSchool(
                                testClient,
                                organizationId,
                                'My School',
                                undefined,
                                { authorization: orgOwnerToken }
                            )
                        )?.school_id
                        await addUserToSchool(testClient, studentId, schoolId, {
                            authorization: orgOwnerToken,
                        })
                        await addRoleToSchoolMembership(
                            testClient,
                            studentId,
                            schoolId,
                            studentRoleId
                        )
                    })

                    it('returns an empty array', async () => {
                        const gqlStudents = await eligibleStudents(
                            testClient,
                            classId,
                            { authorization: arbitraryUserToken }
                        )

                        const userIds = gqlStudents
                            .map((x) => x.user_id)
                            .filter((x) => x !== orgOwnerId)
                        expect(userIds).to.be.an('array').that.is.empty
                    })
                })
            }
        )
        context('when an org has multiple schools', () => {
            let org: Organization
            let schools: School[] = []
            let students: User[] = []
            let teachers: User[] = []
            let class1: Class
            let studentRole: Role
            let teacherRole: Role
            let arbitraryUserToken: string

            beforeEach(async () => {
                await createNonAdminUser(testClient)
                arbitraryUserToken = getNonAdminAuthToken()
                schools = []
                students = []
                teachers = []
                const orgOwner = await createAdminUser(testClient)
                org = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                class1 = (await createClass(
                    testClient,
                    org.organization_id
                )) as Class

                studentRole = await createRole(
                    testClient,
                    org.organization_id,
                    'Student Role'
                )
                await grantPermission(
                    testClient,
                    studentRole.role_id,
                    PermissionName.attend_live_class_as_a_student_187,
                    { authorization: getAdminAuthToken() }
                )

                teacherRole = await createRole(
                    testClient,
                    org.organization_id,
                    'Student Role'
                )
                await grantPermission(
                    testClient,
                    teacherRole.role_id,
                    PermissionName.attend_live_class_as_a_teacher_186,
                    { authorization: getAdminAuthToken() }
                )

                for (let i = 0; i < 2; i++) {
                    schools.push(
                        await createSchool(
                            testClient,
                            org.organization_id,
                            `School ${i}`,
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    )
                    students.push(
                        await createUserAndValidate(testClient, {
                            email: `student${i}@school.com`,
                        } as User)
                    )
                    teachers.push(
                        await createUserAndValidate(testClient, {
                            email: `teacher${i}@school.com`,
                        } as User)
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        students[i].user_id,
                        org.organization_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        teachers[i].user_id,
                        org.organization_id,
                        { authorization: getAdminAuthToken() }
                    )

                    await addRoleToOrganizationMembership(
                        testClient,
                        students[i].user_id,
                        org.organization_id,
                        studentRole.role_id
                    )

                    await addRoleToOrganizationMembership(
                        testClient,
                        teachers[i].user_id,
                        org.organization_id,
                        teacherRole.role_id
                    )

                    await addUserToSchool(
                        testClient,
                        students[i].user_id,
                        schools[i].school_id,
                        {
                            authorization: getAdminAuthToken(),
                        }
                    )

                    await addUserToSchool(
                        testClient,
                        teachers[i].user_id,
                        schools[i].school_id,
                        {
                            authorization: getAdminAuthToken(),
                        }
                    )

                    await addRoleToSchoolMembership(
                        testClient,
                        students[i].user_id,
                        schools[i].school_id,
                        studentRole.role_id
                    )

                    await addRoleToSchoolMembership(
                        testClient,
                        teachers[i].user_id,
                        schools[i].school_id,
                        teacherRole.role_id
                    )
                }
            })

            it('returns all org students if the class has not been assigned to a school', async () => {
                const gqlStudents = await eligibleStudents(
                    testClient,
                    class1.class_id,
                    { authorization: arbitraryUserToken }
                )
                expect(gqlStudents.length).to.eq(2)
            })

            it('returns all org teachers if the class has not been assigned to a school', async () => {
                const gqlStudents = await eligibleTeachers(
                    testClient,
                    class1.class_id,
                    { authorization: arbitraryUserToken }
                )
                expect(gqlStudents.length).to.eq(3) // 2 teachers, 1 org admin
            })

            it('only returns students from the schools that the class has been added to', async () => {
                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[0].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                let gqlStudents = await eligibleStudents(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlStudents.length).to.eq(1)

                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[1].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                gqlStudents = await eligibleStudents(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlStudents.length).to.eq(2)
            })

            it('only returns teachers from the schools that the class has been added to', async () => {
                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[0].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                let gqlTeachers = await eligibleTeachers(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlTeachers.length).to.eq(2) // 1 teacher, 1 org admin

                await addSchoolToClass(
                    testClient,
                    class1.class_id,
                    schools[1].school_id,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                gqlTeachers = await eligibleTeachers(
                    testClient,
                    class1.class_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )
                expect(gqlTeachers.length).to.eq(3) // 2 teachers, 1 org admin
            })
        })
    })

    describe('editTeachers', () => {
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    editTeachersInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.be.empty
                expect(teachers).to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete teacher permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.add_teachers_to_class_20226,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editTeachersInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbTeacher = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const teachers = await dbClass.teachers
                        const classesTeaching = await dbTeacher.classesTeaching
                        expect(classesTeaching).to.be.empty
                        expect(teachers).to.be.empty
                    })
                }
            )

            context(
                'and the user does not have add teacher permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.delete_teacher_from_class_20446,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editTeachersInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbTeacher = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const teachers = await dbClass.teachers
                        const classesTeaching = await dbTeacher.classesTeaching
                        expect(classesTeaching).to.be.empty
                        expect(teachers).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                const userInfo = (u: User) => {
                    return u.user_id
                }
                const classInfo = (c: Class) => {
                    return c.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.add_teachers_to_class_20226,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.delete_teacher_from_class_20446,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('edits teachers in class', async () => {
                    let gqlTeacher = await editTeachersInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlTeacher.map(userInfo)).to.deep.eq([user.user_id])
                    let dbTeacher = await User.findOneOrFail(user.user_id)
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let teachers = (await dbClass.teachers) || []
                    let classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])

                    gqlTeacher = await editTeachersInClass(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlTeacher).to.be.empty
                    dbTeacher = await User.findOneOrFail(user.user_id)
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    teachers = (await dbClass.teachers) || []
                    classesTeaching = (await dbTeacher.classesTeaching) || []
                    expect(teachers).to.be.empty
                    expect(classesTeaching).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the teachers in class', async () => {
                        const gqlTeacher = await editTeachersInClass(
                            testClient,
                            cls.class_id,
                            [user.user_id],
                            { authorization: getNonAdminAuthToken() }
                        )

                        expect(gqlTeacher).to.be.null
                        const dbTeacher = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const teachers = await dbClass.teachers
                        const classesTeaching = await dbTeacher.classesTeaching
                        expect(classesTeaching).to.be.empty
                        expect(teachers).to.be.empty
                    })
                })
            })
        })
    })

    describe('addTeacher', () => {
        context('when not authenticated', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_teachers_to_class_20226,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addTeacherToClass(testClient, cls.class_id, user.user_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.be.empty
                expect(teachers).to.be.empty
            })
        })

        context('when not authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addTeacherToClass(testClient, cls.class_id, user.user_id, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.be.empty
                expect(teachers).to.be.empty
            })
        })

        context('when authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_teachers_to_class_20226,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should add teacher to class', async () => {
                const gqlTeacher = await addTeacherToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlTeacher).to.exist
                expect(user).to.include(gqlTeacher)
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = await dbClass.teachers
                const classesTeaching = await dbTeacher.classesTeaching
                expect(classesTeaching).to.have.lengthOf(1)
                expect(teachers).to.have.lengthOf(1)
                expect(classesTeaching![0].class_id).to.equal(dbClass.class_id)
                expect(teachers![0].user_id).to.equal(dbTeacher.user_id)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not add the teacher in class', async () => {
                    const gqlTeacher = await addTeacherToClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.null
                    const dbTeacher = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const teachers = await dbClass.teachers
                    const classesTeaching = await dbTeacher.classesTeaching
                    expect(classesTeaching).to.be.empty
                    expect(teachers).to.be.empty
                })
            })
        })
    })

    describe('removeTeacher', () => {
        const userInfo = (user: User) => {
            return user.user_id
        }
        const classInfo = (cls: Class) => {
            return cls.class_id
        }

        context(
            'when not authorized within the organization or any school the class belongs to',
            () => {
                let user: User
                let cls: Class

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    user = await createNonAdminUser(testClient)
                    const organization = await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                    await addUserToOrganizationAndValidate(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        { authorization: getAdminAuthToken() }
                    )
                    cls = await createClass(
                        testClient,
                        organization.organization_id
                    )
                    const emptyRole = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        emptyRole.role_id
                    )
                    await addTeacherToClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        removeTeacherInClass(
                            testClient,
                            cls.class_id,
                            user.user_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                    ).to.be.rejected
                    const dbTeacher = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])
                })
            }
        )

        context('when authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_teacher_from_class_20446,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
                await addTeacherToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('removes the teacher from class', async () => {
                const gqlTeacher = await removeTeacherInClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlTeacher).to.be.true
                const dbTeacher = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const teachers = (await dbClass.teachers) || []
                const classesTeaching = (await dbTeacher.classesTeaching) || []
                expect(teachers).to.be.empty
                expect(classesTeaching).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove teacher in class', async () => {
                    const gqlTeacher = await removeTeacherInClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlTeacher).to.be.null
                    const dbTeacher = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])
                })
            })
        })

        context('when authorized within a school', () => {
            let userId: string
            let classId: string
            let organizationId: string
            let schoolId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'My School',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                )?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                await addSchoolToClass(testClient, classId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_teacher_from_class_20446,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    role.role_id
                )
                await addTeacherToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the teacher from class', async () => {
                const gqlTeacher = await removeTeacherInClass(
                    testClient,
                    classId,
                    userId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlTeacher).to.be.true
                const dbTeacher = await User.findOneOrFail(userId)
                const dbClass = await Class.findOneOrFail(classId)
                const teachers = (await dbClass.teachers) || []
                const classesTeaching = (await dbTeacher.classesTeaching) || []
                expect(teachers).to.be.empty
                expect(classesTeaching).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove teacher in class', async () => {
                    const gqlTeacher = await removeTeacherInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.null
                    const dbTeacher = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    expect(teachers.map(userInfo)).to.deep.eq([userId])
                    expect(classesTeaching.map(classInfo)).to.deep.eq([classId])
                })
            })

            context('and the teacher has other assigned school', async () => {
                let otherClassId: string

                beforeEach(async () => {
                    otherClassId = (
                        await createClass(
                            testClient,
                            organizationId,
                            'Other Class'
                        )
                    )?.class_id

                    await addSchoolToClass(testClient, otherClassId, schoolId, {
                        authorization: getAdminAuthToken(),
                    })

                    await addTeacherToClass(testClient, otherClassId, userId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('should have the other class assigned', async () => {
                    const gqlTeacher = await removeTeacherInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.true
                    const dbTeacher = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const teachers = (await dbClass.teachers) || []
                    const classesTeaching =
                        (await dbTeacher.classesTeaching) || []
                    const classIds = classesTeaching.map(
                        ({ class_id }) => class_id
                    )

                    expect(teachers).to.be.empty
                    expect(classesTeaching.length).eq(1)
                    expect(classIds).to.deep.eq([otherClassId])
                })
            })
        })
    })

    describe('editStudents', () => {
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    editStudentsInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.be.empty
                expect(students).to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete student permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.add_students_to_class_20225,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editStudentsInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbStudent = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const students = await dbClass.students
                        const classesStudying = await dbStudent.classesStudying
                        expect(classesStudying).to.be.empty
                        expect(students).to.be.empty
                    })
                }
            )

            context(
                'and the user does not have add student permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.delete_student_from_class_roster_20445,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editStudentsInClass(
                                testClient,
                                cls.class_id,
                                [user.user_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbStudent = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const students = await dbClass.students
                        const classesStudying = await dbStudent.classesStudying
                        expect(classesStudying).to.be.empty
                        expect(students).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                const userInfo = (u: User) => {
                    return u.user_id
                }
                const classInfo = (c: Class) => {
                    return c.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.add_students_to_class_20225,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.delete_student_from_class_roster_20445,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('edits students in class', async () => {
                    let gqlStudent = await editStudentsInClass(
                        testClient,
                        cls.class_id,
                        [user.user_id],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent.map(userInfo)).to.deep.eq([user.user_id])
                    let dbStudent = await User.findOneOrFail(user.user_id)
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let students = (await dbClass.students) || []
                    let classesStudying =
                        (await dbStudent.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([user.user_id])
                    expect(classesStudying.map(classInfo)).to.deep.eq([
                        cls.class_id,
                    ])

                    gqlStudent = await editStudentsInClass(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent).to.be.empty
                    dbStudent = await User.findOneOrFail(user.user_id)
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    students = (await dbClass.students) || []
                    classesStudying = (await dbStudent.classesStudying) || []
                    expect(students).to.be.empty
                    expect(classesStudying).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the students in class', async () => {
                        const gqlStudent = await editStudentsInClass(
                            testClient,
                            cls.class_id,
                            [user.user_id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlStudent).to.be.null
                        const dbStudent = await User.findOneOrFail(user.user_id)
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const students = await dbClass.students
                        const classesStudying = await dbStudent.classesStudying
                        expect(classesStudying).to.be.empty
                        expect(students).to.be.empty
                    })
                })
            })
        })
    })

    describe('addStudent', () => {
        context('when not authenticated', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_students_to_class_20225,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addStudentToClass(testClient, cls.class_id, user.user_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.be.empty
                expect(students).to.be.empty
            })
        })

        context('when not authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addStudentToClass(testClient, cls.class_id, user.user_id, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.be.empty
                expect(students).to.be.empty
            })
        })

        context('when authorized within organization', () => {
            let user: User
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.add_students_to_class_20225,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should add student to class', async () => {
                const gqlStudent = await addStudentToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlStudent).to.exist
                expect(user).to.include(gqlStudent)
                const dbStudent = await User.findOneOrFail(user.user_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const students = await dbClass.students
                const classesStudying = await dbStudent.classesStudying
                expect(classesStudying).to.have.lengthOf(1)
                expect(students).to.have.lengthOf(1)
                expect(classesStudying![0].class_id).to.equal(dbClass.class_id)
                expect(students![0].user_id).to.equal(dbStudent.user_id)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not add the student to class', async () => {
                    const gqlStudent = await addStudentToClass(
                        testClient,
                        cls.class_id,
                        user.user_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent).to.be.null
                    const dbStudent = await User.findOneOrFail(user.user_id)
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const students = await dbClass.students
                    const classesStudying = await dbStudent.classesStudying
                    expect(classesStudying).to.be.empty
                    expect(students).to.be.empty
                })
            })
        })
    })

    describe('removeStudent', () => {
        const userInfo = (user: User) => {
            return user.user_id
        }
        const classInfo = (cls: Class) => {
            return cls.class_id
        }

        context(
            'when not authorized within the organization or any school the class belongs to',
            () => {
                let userId: string
                let classId: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    userId = (await createNonAdminUser(testClient))?.user_id
                    const organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwner.user_id
                        )
                    )?.organization_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        userId,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    const emptyRole = await createRole(
                        testClient,
                        organizationId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        emptyRole.role_id
                    )
                    await addStudentToClass(testClient, classId, userId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        removeStudentInClass(testClient, classId, userId, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                    const dbStudent = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const students = (await dbClass.students) || []
                    const classesStudying =
                        (await dbStudent.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([userId])
                    expect(classesStudying.map(classInfo)).to.deep.eq([classId])
                })
            }
        )

        context('when authorized within organization', () => {
            let userId: string
            let classId: string
            let organization: Organization
            let organizationId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                organizationId = organization?.organization_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                classId = (
                    await createClassFactory(undefined, organization).save()
                )?.class_id
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_student_from_class_roster_20445,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    userId,
                    organizationId,
                    role.role_id
                )
                await addStudentToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the student from class', async () => {
                const gqlStudent = await removeStudentInClass(
                    testClient,
                    classId,
                    userId,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlStudent).to.be.true
                const dbStudent = await User.findOneOrFail(userId)
                const dbClass = await Class.findOneOrFail(classId)
                const students = (await dbClass.students) || []
                const classesStudying = (await dbStudent.classesStudying) || []
                expect(students).to.be.empty
                expect(classesStudying).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove student from class', async () => {
                    const gqlStudent = await removeStudentInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent).to.be.null
                    const dbStudents = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const students = (await dbClass.students) || []
                    const classesStudying =
                        (await dbStudents.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([userId])
                    expect(classesStudying.map(classInfo)).to.deep.eq([classId])
                })
            })

            context('student is added to multiple classes', () => {
                let classId_second: string

                beforeEach(async () => {
                    classId_second = (
                        await createClassFactory(undefined, organization).save()
                    )?.class_id
                    await addStudentToClass(
                        testClient,
                        classId_second,
                        userId,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('removes the student from particular class', async () => {
                    const gqlStudent = await removeStudentInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlStudent).to.be.true
                    const dbStudent = await User.findOneOrFail(userId, {
                        relations: ['classesStudying'],
                    })
                    const dbClass = await Class.findOneOrFail(classId, {
                        relations: ['students'],
                    })
                    const students = (await dbClass.students) || []
                    const classesStudying =
                        (await dbStudent.classesStudying) || []
                    expect(students).to.be.empty
                    expect(classesStudying).to.have.lengthOf(1)
                    expect(classesStudying[0].class_id).to.be.equal(
                        classId_second
                    )
                })
            })
        })

        context('when authorized within a school', () => {
            let userId: string
            let classId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                const organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                const schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'My School',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                )?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                await addSchoolToClass(testClient, classId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.delete_student_from_class_roster_20445,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    role.role_id
                )
                await addStudentToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the student from class', async () => {
                const gqlStudent = await removeStudentInClass(
                    testClient,
                    classId,
                    userId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlStudent).to.be.true
                const dbStudent = await User.findOneOrFail(userId)
                const dbClass = await Class.findOneOrFail(classId)
                const students = (await dbClass.students) || []
                const classesStudying = (await dbStudent.classesStudying) || []
                expect(students).to.be.empty
                expect(classesStudying).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove student in class', async () => {
                    const gqlStudent = await removeStudentInClass(
                        testClient,
                        classId,
                        userId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlStudent).to.be.null
                    const dbStudent = await User.findOneOrFail(userId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const students = (await dbClass.students) || []
                    const classesStudying =
                        (await dbStudent.classesStudying) || []
                    expect(students.map(userInfo)).to.deep.eq([userId])
                    expect(classesStudying.map(classInfo)).to.deep.eq([classId])
                })
            })
        })
    })

    describe('editSchools', () => {
        let school: School
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
            school = await createSchool(
                testClient,
                organization.organization_id,
                'my school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    editSchoolsInClass(
                        testClient,
                        cls.class_id,
                        [school.school_id],
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.be.empty
                expect(schools).to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have edit school permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_class_20334,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entries', async () => {
                        await expect(
                            editSchoolsInClass(
                                testClient,
                                cls.class_id,
                                [school.school_id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected
                        const dbSchool = await School.findOneOrFail(
                            school.school_id
                        )
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const schools = await dbClass.schools
                        const classes = await dbSchool.classes
                        expect(classes).to.be.empty
                        expect(schools).to.be.empty
                    })
                }
            )

            context('and the user does not have edit class permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_school_20330,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        editSchoolsInClass(
                            testClient,
                            cls.class_id,
                            [school.school_id],
                            { authorization: getNonAdminAuthToken() }
                        )
                    ).to.be.rejected
                    const dbSchool = await School.findOneOrFail(
                        school.school_id
                    )
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const schools = await dbClass.schools
                    const classes = await dbSchool.classes
                    expect(classes).to.be.empty
                    expect(schools).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                const schoolInfo = (s: School) => {
                    return s.school_id
                }
                const classInfo = (c: Class) => {
                    return c.class_id
                }

                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_school_20330,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('edits schools in class', async () => {
                    let gqlSchool = await editSchoolsInClass(
                        testClient,
                        cls.class_id,
                        [school.school_id],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool.map(schoolInfo)).to.deep.eq([
                        school.school_id,
                    ])
                    let dbSchool = await School.findOneOrFail(school.school_id)
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let schools = (await dbClass.schools) || []
                    let classes = (await dbSchool.classes) || []
                    expect(schools.map(schoolInfo)).to.deep.eq([
                        school.school_id,
                    ])
                    expect(classes.map(classInfo)).to.deep.eq([cls.class_id])

                    gqlSchool = await editSchoolsInClass(
                        testClient,
                        cls.class_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool).to.be.empty
                    dbSchool = await School.findOneOrFail(school.school_id)
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    schools = (await dbClass.schools) || []
                    classes = (await dbSchool.classes) || []
                    expect(schools).to.be.empty
                    expect(classes).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the schools in class', async () => {
                        const gqlSchool = await editSchoolsInClass(
                            testClient,
                            cls.class_id,
                            [school.school_id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSchool).to.be.null
                        const dbSchool = await School.findOneOrFail(
                            school.school_id
                        )
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        const schools = await dbClass.schools
                        const classes = await dbSchool.classes
                        expect(classes).to.be.empty
                        expect(schools).to.be.empty
                    })
                })
            })
        })
    })

    describe('addSchool', () => {
        context('when not authenticated', () => {
            let school: School
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                school = await createSchool(
                    testClient,
                    organization.organization_id,
                    'my school',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_school_20330,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addSchoolToClass(
                        testClient,
                        cls.class_id,
                        school.school_id,
                        { authorization: undefined }
                    )
                ).to.be.rejected
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.be.empty
                expect(schools).to.be.empty
            })
        })

        context('when not authorized within organization', () => {
            let school: School
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                school = await createSchool(
                    testClient,
                    organization.organization_id,
                    'my school',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const emptyRole = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    emptyRole.role_id
                )
            })

            it('should throw a permission exception and not mutate the database entries', async () => {
                await expect(
                    addSchoolToClass(
                        testClient,
                        cls.class_id,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                ).to.be.rejected
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.be.empty
                expect(schools).to.be.empty
            })
        })

        context('when authorized within organization', () => {
            let school: School
            let cls: Class

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                const user = await createNonAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    { authorization: getAdminAuthToken() }
                )
                school = await createSchool(
                    testClient,
                    organization.organization_id,
                    'my school',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                const role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_school_20330,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organization.organization_id,
                    role.role_id
                )
            })

            it('should add school to class', async () => {
                const gqlSchool = await addSchoolToClass(
                    testClient,
                    cls.class_id,
                    school.school_id,
                    { authorization: getNonAdminAuthToken() }
                )
                expect(gqlSchool).to.exist
                expect(school).to.include(gqlSchool)
                const dbSchool = await School.findOneOrFail(school.school_id)
                const dbClass = await Class.findOneOrFail(cls.class_id)
                const schools = await dbClass.schools
                const classes = await dbSchool.classes
                expect(classes).to.have.lengthOf(1)
                expect(schools).to.have.lengthOf(1)
                expect(classes![0].class_id).to.equal(dbClass.class_id)
                expect(schools![0].school_id).to.equal(dbSchool.school_id)
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, cls.class_id, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('does not add the school to class', async () => {
                    const gqlSchool = await addSchoolToClass(
                        testClient,
                        cls.class_id,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool).to.be.null
                    const dbSchool = await School.findOneOrFail(
                        school.school_id
                    )
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    const schools = await dbClass.schools
                    const classes = await dbSchool.classes
                    expect(classes).to.be.empty
                    expect(schools).to.be.empty
                })
            })
        })
    })

    describe('removeSchool', () => {
        const schoolInfo = (school: School) => {
            return school.school_id
        }
        const classInfo = (cls: Class) => {
            return cls.class_id
        }

        context(
            'when not authorized within the organization or any school the class belongs to',
            () => {
                let userId: string
                let classId: string
                let schoolId: string

                beforeEach(async () => {
                    const orgOwner = await createAdminUser(testClient)
                    userId = (await createNonAdminUser(testClient))?.user_id
                    const organizationId = (
                        await createOrganizationAndValidate(
                            testClient,
                            orgOwner.user_id
                        )
                    )?.organization_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'My School',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    )?.school_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        userId,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                    await addUserToSchool(testClient, userId, schoolId, {
                        authorization: getAdminAuthToken(),
                    })
                    classId = (await createClass(testClient, organizationId))
                        ?.class_id
                    await addSchoolToClass(testClient, classId, schoolId, {
                        authorization: getAdminAuthToken(),
                    })
                    const emptyRole = await createRole(
                        testClient,
                        organizationId
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        emptyRole.role_id
                    )
                    await addTeacherToClass(testClient, classId, userId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('should throw a permission exception and not mutate the database entries', async () => {
                    await expect(
                        removeSchoolFromClass(testClient, classId, schoolId, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                    const dbSchool = await School.findOneOrFail(schoolId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const classSchools = (await dbClass.schools) || []
                    const schoolClasses = (await dbSchool.classes) || []
                    expect(classSchools.map(schoolInfo)).to.deep.eq([schoolId])
                    expect(schoolClasses.map(classInfo)).to.deep.eq([classId])
                })
            }
        )

        context('when authorized within organization', () => {
            let userId: string
            let classId: string
            let school: School
            let schoolId: string
            let organization: Organization
            let organizationId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                organization = await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
                organizationId = organization?.organization_id
                school = await createSchool(
                    testClient,
                    organizationId,
                    'My School',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                schoolId = school?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (
                    await createClassFactory([school], organization).save()
                )?.class_id
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    userId,
                    organizationId,
                    role.role_id
                )
            })

            it('removes the school from class', async () => {
                const gqlSchool = await removeSchoolFromClass(
                    testClient,
                    classId,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlSchool).to.be.true
                const dbSchool = await School.findOneOrFail(schoolId)
                const dbClass = await Class.findOneOrFail(classId)
                const classSchools = (await dbClass.schools) || []
                const schoolClasses = (await dbSchool.classes) || []
                expect(classSchools).to.be.empty
                expect(schoolClasses).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove school from class', async () => {
                    const gqlSchool = await removeSchoolFromClass(
                        testClient,
                        classId,
                        schoolId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlSchool).to.be.null
                    const dbSchool = await School.findOneOrFail(schoolId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const classSchools = (await dbClass.schools) || []
                    const schoolClasses = (await dbSchool.classes) || []
                    expect(classSchools.map(schoolInfo)).to.deep.eq([schoolId])
                    expect(schoolClasses.map(classInfo)).to.deep.eq([classId])
                })
            })

            context('and school is added to multiple classes', () => {
                let classId_second: string

                beforeEach(async () => {
                    classId_second = (
                        await createClassFactory(
                            [school],
                            organization,
                            undefined
                        ).save()
                    )?.class_id
                })

                it('school is removed from particular class', async () => {
                    const gqlSchool = await removeSchoolFromClass(
                        testClient,
                        classId,
                        schoolId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlSchool).to.be.true
                    const dbSchool = await School.findOneOrFail(schoolId, {
                        relations: ['classes'],
                    })
                    const dbClass = await Class.findOneOrFail(classId, {
                        relations: ['schools'],
                    })
                    const classSchools = (await dbClass.schools) || []
                    const schoolClasses = (await dbSchool.classes) || []
                    expect(classSchools).to.be.empty
                    expect(schoolClasses).to.have.lengthOf(1)
                    expect(schoolClasses[0].class_id).to.equal(classId_second)
                })
            })
        })

        context('when authorized within a school', () => {
            let userId: string
            let classId: string
            let schoolId: string

            beforeEach(async () => {
                const orgOwner = await createAdminUser(testClient)
                userId = (await createNonAdminUser(testClient))?.user_id
                const organizationId = (
                    await createOrganizationAndValidate(
                        testClient,
                        orgOwner.user_id
                    )
                )?.organization_id
                schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'My School',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                )?.school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(testClient, userId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                classId = (await createClass(testClient, organizationId))
                    ?.class_id
                await addSchoolToClass(testClient, classId, schoolId, {
                    authorization: getAdminAuthToken(),
                })
                const role = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    role.role_id,
                    PermissionName.edit_class_20334,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    role.role_id
                )
                await addTeacherToClass(testClient, classId, userId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('removes the school from class', async () => {
                const gqlSchool = await removeSchoolFromClass(
                    testClient,
                    classId,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlSchool).to.be.true
                const dbSchool = await School.findOneOrFail(schoolId)
                const dbClass = await Class.findOneOrFail(classId)
                const classSchools = (await dbClass.schools) || []
                const schoolClasses = (await dbSchool.classes) || []
                expect(classSchools).to.be.empty
                expect(schoolClasses).to.be.empty
            })

            context('and the class is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteClass(testClient, classId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('fails to remove school from class', async () => {
                    const gqlTeacher = await removeSchoolFromClass(
                        testClient,
                        classId,
                        schoolId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlTeacher).to.be.null
                    const dbSchool = await School.findOneOrFail(schoolId)
                    const dbClass = await Class.findOneOrFail(classId)
                    const classSchools = (await dbClass.schools) || []
                    const schoolClasses = (await dbSchool.classes) || []
                    expect(classSchools.map(schoolInfo)).to.deep.eq([schoolId])
                    expect(schoolClasses.map(classInfo)).to.deep.eq([classId])
                })
            })
        })
    })

    describe('delete', () => {
        let user: User
        let cls: Class
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            cls = await createClass(testClient, organization.organization_id)
        })

        context('when not authenticated', () => {
            it('should throw a permission exception and not mutate the database entry', async () => {
                await expect(
                    deleteClass(testClient, cls.class_id, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected
                const dbClass = await Class.findOneOrFail(cls.class_id)
                expect(dbClass.status).to.eq(Status.ACTIVE)
                expect(dbClass.deleted_at).to.be.null
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete class permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception and not mutate the database entry', async () => {
                        await expect(
                            deleteClass(testClient, cls.class_id, {
                                authorization: getNonAdminAuthToken(),
                            })
                        ).to.be.rejected
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        expect(dbClass.status).to.eq(Status.ACTIVE)
                        expect(dbClass.deleted_at).to.be.null
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.delete_class_20444,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('deletes the class', async () => {
                    const successful = await deleteClass(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(successful).to.be.true
                    const dbClass = await Class.findOneOrFail(cls.class_id)
                    expect(dbClass.status).to.eq(Status.INACTIVE)
                    expect(dbClass.deleted_at).not.to.be.null
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('fails to delete the class', async () => {
                        const successful = await deleteClass(
                            testClient,
                            cls.class_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(successful).to.be.null
                        const dbClass = await Class.findOneOrFail(cls.class_id)
                        expect(dbClass.status).to.eq(Status.INACTIVE)
                        expect(dbClass.deleted_at).not.to.be.null
                    })
                })
            })
        })
    })

    describe('programs', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let program: Program

        let programDetails: any

        const entityInfo = (entity: any) => {
            return entity.id
        }

        const programInfo = async (p: Program) => {
            return {
                name: p.name,
                age_ranges: ((await p.age_ranges) || []).map(entityInfo),
                grades: ((await p.grades) || []).map(entityInfo),
                subjects: ((await p.subjects) || []).map(entityInfo),
                system: p.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            program = createProgram(organization)
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        it('lists all the programs in the class', async () => {
            programDetails = await programInfo(program)

            const gqlPrograms = await listPrograms(testClient, cls.class_id, {
                authorization: getNonAdminAuthToken(),
            })

            const dbClass = await Class.findOneOrFail(cls.class_id)
            const dbPrograms = (await dbClass.programs) || []

            const gqlProgramDetails = await Promise.all(
                gqlPrograms.map(programInfo)
            )
            const dbProgramDetails = await Promise.all(
                dbPrograms.map(programInfo)
            )

            expect(dbPrograms).not.to.be.empty
            expect(gqlProgramDetails).to.deep.eq([programDetails])
            expect(gqlProgramDetails).to.deep.eq(dbProgramDetails)
        })
    })

    describe('editPrograms', () => {
        let organization: Organization
        let cls: Class
        let program: Program
        let organizationId: string
        let otherUserId: string

        const programInfo = (p: any) => {
            return p.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)

            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            organizationId = organization.organization_id
            cls = await createClass(testClient, organization.organization_id)

            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )

            program = createProgram(organization)
            await program.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editPrograms(testClient, cls.class_id, [program.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbPrograms = (await cls.programs) || []
                expect(dbPrograms).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(testClient, organizationId)
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organizationId,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editPrograms(testClient, cls.class_id, [program.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbPrograms = (await cls.programs) || []
                    expect(dbPrograms).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class programs', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbPrograms = (await dbClass.programs) || []
                    expect(dbPrograms).to.be.empty

                    const gqlPrograms = await editPrograms(
                        testClient,
                        cls.class_id,
                        [program.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbPrograms = (await dbClass.programs) || []
                    expect(dbPrograms).not.to.be.empty
                    expect(dbPrograms.map(programInfo)).to.deep.eq(
                        gqlPrograms.map(programInfo)
                    )

                    await editPrograms(testClient, cls.class_id, [], {
                        authorization: getNonAdminAuthToken(),
                    })
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbPrograms = (await dbClass.programs) || []
                    expect(dbPrograms).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class programs', async () => {
                        const gqlPrograms = await editPrograms(
                            testClient,
                            cls.class_id,
                            [program.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlPrograms).to.be.null

                        const dbPrograms = (await cls.programs) || []
                        expect(dbPrograms).to.be.empty
                    })
                })
            })
        })
    })

    describe('age_ranges', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let ageRange: AgeRange
        let program: Program

        const ageRangeInfo = (ar: any) => {
            return {
                id: ar.id,
                name: ar.name,
                system: ar.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            ageRange = createAgeRange(organization)
            await ageRange.save()
            await editAgeRanges(testClient, cls.class_id, [ageRange.id], {
                authorization: getAdminAuthToken(),
            })
            program = createProgram(organization, [ageRange], [], [])
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view class permissions', () => {
                // Test skipped because permission check no longer occurs in source
                // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                it.skip('fails to list age ranges in the class', async () => {
                    await expect(
                        listAgeRanges(testClient, cls.class_id, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_classes_20114,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the age ranges in the class', async () => {
                    const gqlAgeRanges = await listAgeRanges(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlAgeRanges).not.to.be.empty
                    expect(gqlAgeRanges.map(ageRangeInfo)).to.deep.eq([
                        ageRangeInfo(ageRange),
                    ])
                })
            })
        })
    })

    describe('grades', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let grade: Grade
        let program: Program

        const gradeInfo = (g: any) => {
            return {
                id: g.id,
                name: g.name,
                system: g.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            grade = createGrade(organization)
            await grade.save()
            await editGrades(testClient, cls.class_id, [grade.id], {
                authorization: getAdminAuthToken(),
            })
            program = createProgram(organization, [], [grade], [])
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view class permissions', () => {
                // Test skipped because permission check no longer occurs in source
                // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                it.skip('fails to list grades in the class', async () => {
                    await expect(
                        listGrades(testClient, cls.class_id, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_classes_20114,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the grades in the class', async () => {
                    const gqlGrades = await listGrades(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlGrades).not.to.be.empty
                    expect(gqlGrades.map(gradeInfo)).to.deep.eq([
                        gradeInfo(grade),
                    ])
                })
            })
        })
    })

    describe('subjects', () => {
        let user: User
        let organization: Organization
        let cls: Class
        let subject: Subject
        let program: Program

        const subjectInfo = (s: any) => {
            return {
                id: s.id,
                name: s.name,
                system: s.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            subject = createSubject(organization)
            await subject.save()
            await editSubjects(testClient, cls.class_id, [subject.id], {
                authorization: getAdminAuthToken(),
            })
            program = createProgram(organization, [], [], [subject])
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await program.save()
            await editPrograms(testClient, cls.class_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view class permissions', () => {
                // Test skipped because permission check no longer occurs in source
                // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                it.skip('fails to list subjects in the class', async () => {
                    await expect(
                        listSubjects(testClient, cls.class_id, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_classes_20114,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the subjects in the class', async () => {
                    const gqlSubjects = await listSubjects(
                        testClient,
                        cls.class_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlSubjects).not.to.be.empty
                    expect(gqlSubjects.map(subjectInfo)).to.deep.eq([
                        subjectInfo(subject),
                    ])
                })
            })
        })
    })

    describe('editAgeRanges', () => {
        let organization: Organization
        let cls: Class
        let ageRange: AgeRange
        let otherUserId: string

        const ageRangeInfo = (ar: any) => {
            return ar.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            ageRange = createAgeRange(organization)
            await ageRange.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editAgeRanges(testClient, cls.class_id, [ageRange.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbAgeRanges = (await cls.age_ranges) || []
                expect(dbAgeRanges).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organization.organization_id,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editAgeRanges(testClient, cls.class_id, [ageRange.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbAgeRanges = (await cls.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class age ranges', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbAgeRanges = (await dbClass.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty

                    const gqlAgeRanges = await editAgeRanges(
                        testClient,
                        cls.class_id,
                        [ageRange.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbAgeRanges = (await dbClass.age_ranges) || []
                    expect(dbAgeRanges).not.to.be.empty
                    expect(dbAgeRanges.map(ageRangeInfo)).to.deep.eq(
                        gqlAgeRanges.map(ageRangeInfo)
                    )

                    await editAgeRanges(testClient, cls.class_id, [], {
                        authorization: getNonAdminAuthToken(),
                    })
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbAgeRanges = (await dbClass.age_ranges) || []
                    expect(dbAgeRanges).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class age ranges', async () => {
                        const gqlAgeRanges = await editAgeRanges(
                            testClient,
                            cls.class_id,
                            [ageRange.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlAgeRanges).to.be.null

                        const dbAgeRanges = (await cls.age_ranges) || []
                        expect(dbAgeRanges).to.be.empty
                    })
                })
            })
        })
    })

    describe('editGrades', () => {
        let organization: Organization
        let cls: Class
        let grade: Grade
        let otherUserId: string

        const gradeInfo = (g: any) => {
            return g.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            grade = createGrade(organization)
            await grade.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editGrades(testClient, cls.class_id, [grade.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbGrades = (await cls.grades) || []
                expect(dbGrades).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organization.organization_id,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editGrades(testClient, cls.class_id, [grade.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbGrades = (await cls.grades) || []
                    expect(dbGrades).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class grades', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbGrades = (await dbClass.grades) || []
                    expect(dbGrades).to.be.empty

                    const gqlGrades = await editGrades(
                        testClient,
                        cls.class_id,
                        [grade.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbGrades = (await dbClass.grades) || []
                    expect(dbGrades).not.to.be.empty
                    expect(dbGrades.map(gradeInfo)).to.deep.eq(
                        gqlGrades.map(gradeInfo)
                    )

                    await editGrades(testClient, cls.class_id, [], {
                        authorization: getNonAdminAuthToken(),
                    })
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbGrades = (await dbClass.grades) || []
                    expect(dbGrades).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class grades', async () => {
                        const gqlGrades = await editGrades(
                            testClient,
                            cls.class_id,
                            [grade.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlGrades).to.be.null

                        const dbGrades = (await cls.grades) || []
                        expect(dbGrades).to.be.empty
                    })
                })
            })
        })
    })

    describe('editSubjects', () => {
        let organization: Organization
        let cls: Class
        let subject: Subject
        let otherUserId: string

        const subjectInfo = (s: any) => {
            return s.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            cls = await createClass(testClient, organization.organization_id)
            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            subject = createSubject(organization)
            await subject.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                await expect(
                    editSubjects(testClient, cls.class_id, [subject.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbSubjects = (await cls.subjects) || []
                expect(dbSubjects).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(
                    testClient,
                    organization.organization_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organization.organization_id,
                    role.role_id
                )
            })

            context('and the user does not have edit class permissions', () => {
                it('throws a permission error', async () => {
                    await expect(
                        editSubjects(testClient, cls.class_id, [subject.id], {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbSubjects = (await cls.subjects) || []
                    expect(dbSubjects).to.be.empty
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_class_20334,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the class subjects', async () => {
                    let dbClass = await Class.findOneOrFail(cls.class_id)
                    let dbSubjects = (await dbClass.subjects) || []
                    expect(dbSubjects).to.be.empty

                    const gqlSubjects = await editSubjects(
                        testClient,
                        cls.class_id,
                        [subject.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbSubjects = (await dbClass.subjects) || []
                    expect(dbSubjects).not.to.be.empty
                    expect(dbSubjects.map(subjectInfo)).to.deep.eq(
                        gqlSubjects.map(subjectInfo)
                    )

                    await editSubjects(testClient, cls.class_id, [], {
                        authorization: getNonAdminAuthToken(),
                    })
                    dbClass = await Class.findOneOrFail(cls.class_id)
                    dbSubjects = (await dbClass.subjects) || []
                    expect(dbSubjects).to.be.empty
                })

                context('and the class is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteClass(testClient, cls.class_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the class subjects', async () => {
                        const gqlSubjects = await editSubjects(
                            testClient,
                            cls.class_id,
                            [subject.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSubjects).to.be.null

                        const dbSubjects = (await cls.subjects) || []
                        expect(dbSubjects).to.be.empty
                    })
                })
            })
        })
    })

    describe('.updateClasses', () => {
        let ctx: { permissions: UserPermissions }
        let org1: Organization
        let org2: Organization
        let org1Membership: OrganizationMembership
        let org2Membership: OrganizationMembership
        let role1: Role
        let role2: Role
        let updateClasses: UpdateClasses
        let clientUser: User
        let class1: Class
        let class2: Class
        let inputs: UpdateClassInput[]
        let entityMaps: UpdateClassEntityMap
        let class1UpdatedName: string
        let class2UpdatedName: string
        let class1UpdatedShortcode: string
        let class2UpdatedShortcode: string

        beforeEach(async () => {
            clientUser = await createUser().save()
            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            role1 = await createRoleFactory(undefined, org1, {
                permissions: [PermissionName.edit_class_20334],
            }).save()
            role2 = await createRoleFactory(undefined, org2, {
                permissions: [PermissionName.edit_class_20334],
            }).save()
            org1Membership = await createOrganizationMembership({
                user: clientUser,
                organization: org1,
                roles: [role1],
            }).save()
            org2Membership = await createOrganizationMembership({
                user: clientUser,
                organization: org2,
                roles: [role2],
            }).save()
            const permissions = new UserPermissions(userToPayload(clientUser))
            ctx = { permissions }

            class1 = await createClassFactory(undefined, org1).save()
            class2 = await createClassFactory(undefined, org2).save()

            class1UpdatedName = 'Updated Class 1 Name'
            class2UpdatedName = 'Updated Class 2 Name'
            class1UpdatedShortcode = 'UPDATEDSC1'
            class2UpdatedShortcode = 'UPDATEDSC2'

            inputs = [
                {
                    classId: class1.class_id,
                    className: class1UpdatedName,
                    shortcode: class1UpdatedShortcode,
                },
                {
                    classId: class2.class_id,
                    className: class2UpdatedName,
                    shortcode: class2UpdatedShortcode,
                },
            ]

            updateClasses = new UpdateClasses(inputs, ctx.permissions)
        })

        context('normalize', () => {
            it('preserves input element positions and length', () => {
                for (const inputLength of [0, 1, 2, 5]) {
                    const input: UpdateClassInput[] = Array.from(
                        Array(inputLength)
                    ).map(() => {
                        return {
                            classId: uuid_v4(),
                            className: faker.random.word(),
                            shortcode: generateShortCode(),
                        }
                    })

                    const normalized = updateClasses.normalize(input)
                    expect(normalized.length).to.eq(input.length)
                    expect(normalized.map((n) => n.classId)).to.deep.equal(
                        input.map((i) => i.classId)
                    )
                    expect(normalized.map((n) => n.className)).to.deep.equal(
                        input.map((i) => i.className)
                    )
                    expect(normalized.map((n) => n.shortcode)).to.deep.equal(
                        input.map((i) => i.shortcode)
                    )
                }
            })

            context('shortcodes', () => {
                const checkShortcode = (
                    shortcode: string | undefined
                ): string | undefined => {
                    const input: UpdateClassInput[] = [
                        {
                            classId: uuid_v4(),
                            className: faker.random.word(),
                            shortcode,
                        },
                    ]

                    const normalized = updateClasses.normalize(input)
                    expect(normalized.length).to.eq(input.length)
                    return normalized[0].shortcode
                }

                it('does not re-generate shortcode when not supplied by caller', () => {
                    const normalizedShortcode = checkShortcode(undefined)
                    expect(normalizedShortcode).to.be.undefined
                })

                it('normalizes shortcodes to uppercase', () => {
                    const invalidShortcode = generateShortCode().toLowerCase()
                    expect(validateShortCode(invalidShortcode)).to.be.false

                    const normalizedShortcode = checkShortcode(invalidShortcode)
                    expect(normalizedShortcode).to.eq(
                        invalidShortcode.toUpperCase()
                    )
                })

                it('preserves invalid shortcodes', () => {
                    const invalidShortcode = '!!!!!'
                    expect(validateShortCode(invalidShortcode)).to.be.false

                    const normalizedShortcode = checkShortcode(invalidShortcode)
                    expect(normalizedShortcode).to.eq(invalidShortcode)
                })

                it('preserves valid shortcodes', () => {
                    const validShortcode = generateShortCode()
                    const normalizedShortcode = checkShortcode(validShortcode)
                    expect(normalizedShortcode).to.eq(validShortcode)
                })
            })
        })

        context('generateEntityMaps', () => {
            it('creates maps from input classIds to active classes', async () => {
                class2.status = Status.INACTIVE
                await class2.save()

                const actualEntityMap = await updateClasses.generateEntityMaps(
                    inputs
                )

                expect(
                    Array.from(actualEntityMap.mainEntity.keys())
                ).to.deep.equal([class1.class_id])
                expect(
                    actualEntityMap.mainEntity.get(class1.class_id)!.class_id
                ).to.eq(class1.class_id)
                expect(
                    actualEntityMap.mainEntity.get(class1.class_id)!.class_name
                ).to.eq(class1.class_name)
                expect(
                    actualEntityMap.mainEntity.get(class1.class_id)!.shortcode
                ).to.eq(class1.shortcode)
                expect(
                    actualEntityMap.mainEntity.get(class1.class_id)!.status
                ).to.eq(Status.ACTIVE)
            })

            it('creates maps from input classIds to any existing classes with matching names', async () => {
                const classWithMatchingName = createClassFactory(
                    undefined,
                    org1
                )
                classWithMatchingName.class_name = class2UpdatedName // Already exists in DB
                await classWithMatchingName.save()

                const actualEntityMap = await updateClasses.generateEntityMaps(
                    inputs
                )

                expect(
                    Array.from(
                        actualEntityMap.existingOrgClassesWithMatchingNames.keys()
                    )
                ).to.deep.equal([
                    {
                        className: classWithMatchingName.class_name,
                        orgId: org1.organization_id,
                    },
                ])
            })

            it('creates maps from input classIds to any existing classes with matching shortcodes', async () => {
                const classWithMatchingShortcode = createClassFactory(
                    undefined,
                    org1
                )
                classWithMatchingShortcode.shortcode = class2UpdatedShortcode
                await classWithMatchingShortcode.save()

                const actualEntityMap = await updateClasses.generateEntityMaps(
                    inputs
                )

                expect(
                    Array.from(
                        actualEntityMap.existingOrgClassesWithMatchingShortcodes.keys()
                    )
                ).to.deep.equal([
                    {
                        classShortcode: classWithMatchingShortcode.shortcode,
                        orgId: org1.organization_id,
                    },
                ])
            })
        })

        context('authorize', () => {
            context(
                'when user has correct permission for all orgs of inputted classes',
                () => {
                    beforeEach(async () => {
                        entityMaps = await updateClasses.generateEntityMaps(
                            inputs
                        )
                    })

                    it('fulfills its promise', async () => {
                        await expect(
                            updateClasses.authorize(inputs, entityMaps)
                        ).to.be.eventually.fulfilled
                    })
                }
            )

            context(
                'when user has insufficient permissions for some orgs of inputted classes',
                () => {
                    beforeEach(async () => {
                        entityMaps = await updateClasses.generateEntityMaps(
                            inputs
                        )
                        org2Membership.roles = Promise.resolve([])
                        await org2Membership.save()
                    })

                    it('rejects its promise with the correct message', async () => {
                        await expect(
                            updateClasses.authorize(inputs, entityMaps)
                        ).to.be.eventually.rejectedWith(
                            /User\(.*\) does not have Permission\(edit_class_20334\) in Organizations\(.*\)/
                        )
                    })
                }
            )
        })

        context('validationOverAllInputs', () => {
            it('generates duplicate-code APIErrors if there are duplicate IDs in input', async () => {
                inputs[1].classId = class1.class_id // Means two update operations are inputted for the same class. Ut oh!
                updateClasses = new UpdateClasses(inputs, ctx.permissions)
                entityMaps = await updateClasses.generateEntityMaps(inputs)

                const {
                    validInputs,
                    apiErrors,
                } = updateClasses.validationOverAllInputs(inputs, entityMaps)
                expect(validInputs.length).to.eq(1)

                const expectedError = createDuplicateAttributeAPIError(
                    1,
                    ['classId'],
                    'UpdateClassInput'
                )
                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], expectedError)
            })

            it('generates duplicate-attribute-code APIErrors if there are duplicate (org,className) pairs derived from input', async () => {
                class2.organization = class1.organization
                await class2.save()
                inputs[1].className = inputs[0].className
                updateClasses = new UpdateClasses(inputs, ctx.permissions)
                entityMaps = await updateClasses.generateEntityMaps(inputs)

                const {
                    validInputs,
                    apiErrors,
                } = updateClasses.validationOverAllInputs(inputs, entityMaps)
                expect(validInputs.length).to.eq(1)

                const expectedError = createDuplicateInputAttributeAPIError(
                    1,
                    'Class',
                    (await class2.organization)!.organization_id,
                    'className',
                    inputs[1].className!
                )
                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], expectedError)
            })

            it('generates duplicate-attribute-code APIErrors if there are duplicate (org,shortcode) pairs derived from input', async () => {
                class2.organization = class1.organization
                await class2.save()
                inputs[1].shortcode = inputs[0].shortcode
                updateClasses = new UpdateClasses(inputs, ctx.permissions)
                entityMaps = await updateClasses.generateEntityMaps(inputs)

                const {
                    validInputs,
                    apiErrors,
                } = updateClasses.validationOverAllInputs(inputs, entityMaps)
                expect(validInputs.length).to.eq(1)

                const expectedError = createDuplicateInputAttributeAPIError(
                    1,
                    'Class',
                    (await class2.organization)!.organization_id,
                    'shortcode',
                    inputs[1].shortcode!
                )
                expect(apiErrors.length).to.eq(1)
                compareErrors(apiErrors[0], expectedError)
            })
        })

        context('validate', () => {
            context(
                'input contains a class ID which does not exist in the database',
                () => {
                    beforeEach(async () => {
                        entityMaps.mainEntity.delete(class2.class_id)
                        await class2.remove()
                    })

                    it('records a non-existent-code error', () => {
                        const actualErrors = updateClasses.validate(
                            1,
                            undefined,
                            inputs[1],
                            entityMaps
                        )
                        const expectedError = createEntityAPIError(
                            'nonExistent',
                            1,
                            'Class',
                            inputs[1].classId
                        )
                        expect(actualErrors.length).to.eq(1)
                        compareErrors(actualErrors[0], expectedError)
                    })
                }
            )

            context(
                'input is trying to update a class name which is already shared by another existing class in the same org',
                () => {
                    let class3: Class

                    beforeEach(async () => {
                        class3 = createClassFactory(undefined, org2)
                        class3.class_name = class2UpdatedName // Existent class 3 in the same Org2 already has this name
                        await class3.save()
                        entityMaps = await updateClasses.generateEntityMaps(
                            // Make sure to update entityMaps to pull in class3 information
                            inputs
                        )
                    })

                    it('records a duplicateChild-code error', () => {
                        const actualErrors = updateClasses.validate(
                            1,
                            undefined,
                            inputs[1],
                            entityMaps
                        )

                        const expectedError = createEntityAPIError(
                            'existentChild',
                            1,
                            'Class',
                            inputs[1].className,
                            'Organization',
                            org2.organization_id,
                            ['organizationId', 'className']
                        )

                        expect(actualErrors.length).to.eq(1)
                        compareErrors(actualErrors[0], expectedError)
                    })
                }
            )

            context(
                'input is trying to update a class shortcode which is already shared by another existing class in the same org',
                () => {
                    let class3: Class

                    beforeEach(async () => {
                        class3 = createClassFactory(undefined, org2)
                        class3.shortcode = class2UpdatedShortcode // Existent class 3 in the same Org2 already has this shortcode
                        await class3.save()
                        entityMaps = await updateClasses.generateEntityMaps(
                            // Make sure to update entityMaps to pull in class3 information
                            inputs
                        )
                    })

                    it('records a duplicateChild-code error', () => {
                        const actualErrors = updateClasses.validate(
                            1,
                            undefined,
                            inputs[1],
                            entityMaps
                        )

                        const expectedError = createEntityAPIError(
                            'existentChild',
                            1,
                            'Class',
                            inputs[1].shortcode,
                            'Organization',
                            org2.organization_id,
                            ['organizationId', 'shortcode']
                        )

                        expect(actualErrors.length).to.eq(1)
                        compareErrors(actualErrors[0], expectedError)
                    })
                }
            )

            it('records alphanumeric-code invalid shortcodes (preserved from the normalize step)', async () => {
                inputs[1].shortcode = '!@£$%^&'
                updateClasses = new UpdateClasses(inputs, ctx.permissions)
                entityMaps = await updateClasses.generateEntityMaps(inputs)

                const actualErrors = updateClasses.validate(
                    1,
                    undefined,
                    inputs[1],
                    entityMaps
                )
                const expectedError = new APIError({
                    code: customErrors.invalid_alphanumeric.code,
                    message: customErrors.invalid_alphanumeric.message,
                    attribute: 'shortcode',
                    variables: [],
                    entity: 'Class',
                    index: 1,
                })
                expect(actualErrors.length).to.eq(1)
                compareErrors(actualErrors[0], expectedError)
            })

            it('records max-length-code invalid shortcodes (preserved from the normalize step)', async () => {
                inputs[1].shortcode = 'SHORTCODEWHICHAINTSHORT'
                updateClasses = new UpdateClasses(inputs, ctx.permissions)
                entityMaps = await updateClasses.generateEntityMaps(inputs)

                const actualErrors = updateClasses.validate(
                    1,
                    undefined,
                    inputs[1],
                    entityMaps
                )
                const expectedError = new APIError({
                    code: customErrors.invalid_max_length.code,
                    message: customErrors.invalid_max_length.message,
                    variables: [],
                    entity: 'Class',
                    index: 1,
                })
                expect(actualErrors.length).to.eq(1)
                compareErrors(actualErrors[0], expectedError)
            })
        })

        context('process', () => {
            beforeEach(async () => {
                entityMaps = await updateClasses.generateEntityMaps(inputs)
            })

            it('updates the entity with the correct attributes', async () => {
                const actualOutput = updateClasses.process(
                    inputs[0],
                    entityMaps
                )

                expect(actualOutput.outputEntity.class_id).to.eq(
                    inputs[0].classId
                )
                expect(actualOutput.outputEntity.class_name).to.eq(
                    inputs[0].className
                )
                expect(actualOutput.outputEntity.shortcode).to.eq(
                    inputs[0].shortcode
                )
            })
        })

        context('complete mutation calls given valid input', () => {
            let class1InDB: Class
            let class2InDB: Class

            it('provides the correct MutationResult and updates the database', async () => {
                // Before update, record classes' attributes as they are in DB
                class1InDB = (
                    await Class.find({
                        where: [{ class_id: In([class1.class_id]) }],
                    })
                )[0]
                class2InDB = (
                    await Class.find({
                        where: [{ class_id: In([class2.class_id]) }],
                    })
                )[0]
                expect(inputs[0].className).to.not.eq(class1InDB.class_name)
                expect(inputs[0].shortcode).to.not.eq(class1InDB.shortcode)
                expect(inputs[1].className).to.not.eq(class2InDB.class_name)
                expect(inputs[1].shortcode).to.not.eq(class2InDB.shortcode)

                // Perform the mutation
                const result = await mutate(
                    UpdateClasses,
                    { input: inputs },
                    ctx.permissions
                )

                // Check result output
                expect(result.classes.length).to.eq(2)
                expect(result.classes[0].id).to.eq(inputs[0].classId)
                expect(result.classes[0].name).to.eq(inputs[0].className)
                expect(result.classes[0].shortCode).to.eq(inputs[0].shortcode)
                expect(result.classes[1].id).to.eq(inputs[1].classId)
                expect(result.classes[1].name).to.eq(inputs[1].className)
                expect(result.classes[1].shortCode).to.eq(inputs[1].shortcode)

                // Also check the class entities in the DB are actually updated
                class1InDB = (
                    await Class.find({
                        where: [{ class_id: In([class1.class_id]) }],
                    })
                )[0]
                class2InDB = (
                    await Class.find({
                        where: [{ class_id: In([class2.class_id]) }],
                    })
                )[0]
                expect(inputs[0].className).to.eq(class1InDB.class_name)
                expect(inputs[0].shortcode).to.eq(class1InDB.shortcode)
                expect(inputs[1].className).to.eq(class2InDB.class_name)
                expect(inputs[1].shortcode).to.eq(class2InDB.shortcode)
            })

            it('does not make more DB calls than necessary', () => {
                const getDbCallCount = async (input: UpdateClassInput[]) => {
                    connection.logger.reset()
                    await mutate(UpdateClasses, { input }, ctx.permissions)
                    return connection.logger.count
                }

                it('db connections do not increase with number of input elements', async () => {
                    await getDbCallCount([inputs[0]]) // warm up permissions cache
                    const singleClassCount = await getDbCallCount([inputs[0]])
                    const twoClassCount = await getDbCallCount([
                        inputs[0],
                        inputs[1],
                    ])
                    expect(twoClassCount).to.be.eq(singleClassCount)
                    expect(twoClassCount).to.be.equal(5)
                })
            })
        })
    })

    describe('.deleteClasses', () => {
        let org1: Organization
        let org2: Organization
        let class1: Class
        let class2: Class
        let user1: User
        let role1: Role
        let role2: Role
        let input: DeleteClassInput[]

        function deleteClasses(i: DeleteClassInput[], u = user1) {
            const permissions = new UserPermissions(userToPayload(u))
            const ctx = { permissions }
            return deleteClassesResolver({ input: i }, ctx)
        }

        async function checkClassesDeleted(i: DeleteClassInput[]) {
            const classIds = i.map((deleteClassInput) => deleteClassInput.id)
            const classes = await Class.find({
                where: {
                    class_id: In(classIds),
                    status: Status.INACTIVE,
                },
            })
            expect(classIds.length).to.equal(classes.length)
        }

        async function checkNoChangesMade() {
            expect(
                await Class.find({
                    where: {
                        class_id: In(input.map((v) => v.id)),
                        status: Status.INACTIVE,
                    },
                })
            ).to.be.empty
        }

        beforeEach(async () => {
            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            class1 = await createClassFactory(undefined, org1).save()
            class2 = await createClassFactory(undefined, org2).save()
            role1 = await createRoleFactory(undefined, org1, {
                permissions: [PermissionName.delete_class_20444],
            }).save()
            role2 = await createRoleFactory(undefined, org2, {
                permissions: [PermissionName.delete_class_20444],
            }).save()
            user1 = await createUser().save()

            await createOrganizationMembership({
                user: user1,
                organization: org1,
                roles: [role1],
            }).save()

            input = [{ id: class1.class_id }, { id: class2.class_id }]
        })

        context('when user is admin', () => {
            let adminUser: User

            beforeEach(
                async () => (adminUser = await adminUserFactory().save())
            )

            context('when deleting 1 class', () => {
                it('deletes the class', async () => {
                    const singleClass = await createClassFactory().save()
                    const smallInput = [{ id: singleClass.class_id }]
                    await expect(deleteClasses(smallInput, adminUser)).to.be
                        .fulfilled
                    await checkClassesDeleted(smallInput)
                })
            })

            context('when deleting 1 class then 50 classes', () => {
                const dbCallCount = 3 // preloading 1, permission: 1, save: 1

                it('makes the same number of db calls', async () => {
                    const singleClass = await createClassFactory().save()
                    const smallInput = [{ id: singleClass.class_id }]
                    connection.logger.reset()
                    await deleteClasses(smallInput, adminUser)
                    expect(connection.logger.count).to.equal(dbCallCount)

                    const classes = await Class.save(createClassesFactory(50))
                    const bigInput = classes.map((c) => {
                        return { id: c.class_id }
                    })
                    connection.logger.reset()
                    await deleteClasses(bigInput, adminUser)
                    expect(connection.logger.count).to.equal(dbCallCount)
                })
            })
        })

        context('when has permission for deleting classes', () => {
            context("and user belongs to classes' organizations", () => {
                beforeEach(async () => {
                    await createOrganizationMembership({
                        user: user1,
                        organization: org2,
                        roles: [role2],
                    }).save()
                })

                it('deletes classes', async () => {
                    await expect(deleteClasses(input)).to.be.fulfilled
                    await checkClassesDeleted(input)
                })

                it('makes the expected number of database calls', async () => {
                    connection.logger.reset()
                    await deleteClasses(input)
                    expect(connection.logger.count).to.equal(4) // preloading: 1, permissions: 2, save: 1
                })

                context('and a class is inactivated', () => {
                    beforeEach(async () => {
                        await class2.inactivate(getManager())
                    })

                    it('returns inactive_status error and does not inactivate the classes', async () => {
                        const res = await expect(deleteClasses(input)).to.be
                            .rejected
                        expectAPIError.inactive_status(
                            res,
                            {
                                entity: 'Class',
                                entityName: class2.class_id,
                                index: 1,
                            },
                            ['id'],
                            0,
                            1
                        )
                        expect(
                            await Class.find({
                                where: {
                                    class_id: In([class1.class_id]),
                                    status: Status.INACTIVE,
                                },
                            })
                        ).to.be.empty
                    })
                })

                context('and there is a duplicate class', () => {
                    beforeEach(async () => {
                        input.push({ id: class1.class_id })
                    })

                    it('returns duplicate_attribute_values error and does not inactivate the classes', async () => {
                        const res = await expect(deleteClasses(input)).to.be
                            .rejected
                        expectAPIError.duplicate_attribute_values(
                            res,
                            {
                                entity: 'DeleteClassInput',
                                attribute: '(id)',
                                index: 2,
                            },
                            ['id'],
                            0,
                            1
                        )
                        expect(
                            await Class.find({
                                where: {
                                    class_id: In([
                                        class1.class_id,
                                        class2.class_id,
                                    ]),
                                    status: Status.INACTIVE,
                                },
                            })
                        ).to.be.empty
                    })
                })
            })

            context(
                "and does not belong to at least one of classes' organizations",
                () => {
                    it('returns a permission error', async () => {
                        const expectedMessage =
                            `User(${user1.user_id}) does not have Permission` +
                            `(${PermissionName.delete_class_20444}) in Organizations(${org2.organization_id})`
                        await expect(deleteClasses(input)).to.be.rejectedWith(
                            expectedMessage
                        )
                        await checkNoChangesMade()
                    })
                }
            )
        })

        context('does not have permission for deleting classes', () => {
            it('returns a permission error', async () => {
                await createOrganizationMembership({
                    user: user1,
                    organization: org2,
                }).save()
                const expectedMessage =
                    `User(${user1.user_id}) does not have Permission` +
                    `(${PermissionName.delete_class_20444}) in Organizations(${org2.organization_id})`
                await expect(deleteClasses(input)).to.be.rejectedWith(
                    expectedMessage
                )
                await checkNoChangesMade()
            })
        })
    })

    describe('AddProgramsToClasses', () => {
        let adminUser: User
        let nonAdminUser: User
        let organization: Organization
        let classes: Class[]
        let programs: Program[]
        let input: AddProgramsToClassInput[]

        function addPrograms(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return mutate(AddProgramsToClasses, { input }, permissions)
        }

        async function checkOutput() {
            for (const classInputs of input) {
                const { classId, programIds } = classInputs

                const cls = await Class.findOne(classId)
                const dbPrograms = await cls?.programs

                const dbProgramIds = new Set(dbPrograms?.map((val) => val.id))
                const programIdsSet = new Set(programIds)

                expect(dbProgramIds.size).to.equal(programIdsSet.size)
                dbProgramIds.forEach(
                    (val) => expect(programIdsSet.has(val)).to.be.true
                )
            }
        }

        async function checkNoChangesMade(useAdminUser = true) {
            it('does not add the programs', async () => {
                await expect(
                    addPrograms(useAdminUser ? adminUser : nonAdminUser)
                ).to.be.rejected
                const insertedPrograms: Program[] = []
                for (const cls of classes) {
                    const insertedPrograms = await cls.programs
                    if (insertedPrograms) programs.push(...insertedPrograms)
                }
                expect(insertedPrograms).to.have.lengthOf(0)
            })
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            organization = await createOrganization().save()
            classes = createClassesFactory(3)
            programs = createPrograms(3, organization)
            await connection.manager.save([...classes, ...programs])
            input = [
                {
                    classId: classes[0].class_id,
                    programIds: [programs[0].id],
                },
                {
                    classId: classes[1].class_id,
                    programIds: [programs[1].id, programs[2].id],
                },
                {
                    classId: classes[2].class_id,
                    programIds: [programs[0].id, programs[2].id],
                },
            ]
        })

        context(
            'when caller has permissions to add programs to classes',
            () => {
                context('and all attributes are valid', () => {
                    it('adds all the programs', async () => {
                        await expect(addPrograms()).to.be.fulfilled
                        await checkOutput()
                    })
                })

                context('and one of the programs was already added', () => {
                    beforeEach(async () => {
                        classes[0].programs = Promise.resolve([programs[0]])
                        await classes[0].save()
                    })

                    it('returns a duplicate user error', async () => {
                        const res = await expect(addPrograms()).to.be.rejected
                        expectAPIError.existent_child_entity(
                            res,
                            {
                                entity: 'Program',
                                entityName: programs[0].id,
                                parentEntity: 'Class',
                                parentName: classes[0].class_id,
                                index: 0,
                            },
                            [''],
                            0,
                            1
                        )
                    })
                })

                context('and one of the classes is inactive', async () => {
                    beforeEach(
                        async () => await classes[2].inactivate(getManager())
                    )

                    it('returns an nonexistent class error', async () => {
                        const res = await expect(addPrograms()).to.be.rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'Class',
                                id: classes[2].class_id,
                                entryIndex: 2,
                            },
                        ])
                    })

                    await checkNoChangesMade()
                })

                context('and one of the programs is inactive', async () => {
                    beforeEach(
                        async () => await programs[1].inactivate(getManager())
                    )

                    it('returns an nonexistent program error', async () => {
                        const res = await expect(addPrograms()).to.be.rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'Program',
                                id: programs[1].id,
                                entryIndex: 1,
                            },
                        ])
                    })

                    await checkNoChangesMade()
                })

                context('and one of each attribute is inactive', async () => {
                    beforeEach(async () => {
                        await Promise.all([
                            classes[2].inactivate(getManager()),
                            programs[1].inactivate(getManager()),
                        ])
                    })

                    it('returns several nonexistent errors', async () => {
                        const res = await expect(addPrograms()).to.be.rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'Class',
                                id: classes[2].class_id,
                                entryIndex: 2,
                            },
                            {
                                entity: 'Program',
                                id: programs[1].id,
                                entryIndex: 1,
                            },
                        ])
                    })

                    await checkNoChangesMade()
                })

                context('when adding 1 program then 20 programs', () => {
                    it('makes the same number of database calls', async () => {
                        const twentyPrograms = createPrograms(20, organization)
                        connection.logger.reset()
                        input = [
                            {
                                classId: classes[0].class_id,
                                programIds: [programs[0].id],
                            },
                        ]
                        await expect(addPrograms()).to.be.fulfilled
                        const baseCount = connection.logger.count
                        await connection.manager.save([...twentyPrograms])
                        input = [
                            {
                                classId: classes[0].class_id,
                                programIds: twentyPrograms.map((p) => p.id),
                            },
                        ]
                        connection.logger.reset()
                        await expect(addPrograms()).to.be.fulfilled
                        expect(connection.logger.count).to.equal(baseCount)
                    })
                })
            }
        )

        context(
            'when caller does not have permissions to add programs to all classes',
            async () => {
                beforeEach(async () => {
                    const nonAdminRole = await createRoleFactory(
                        'Non Admin Role',
                        organization,
                        {
                            permissions: [PermissionName.edit_class_20334],
                        }
                    ).save()
                    await createOrganizationMembership({
                        user: nonAdminUser,
                        organization: organization,
                        roles: [nonAdminRole],
                    }).save()
                })

                it('returns a permission error', async () => {
                    const errorMessage = buildPermissionError(
                        PermissionName.edit_class_20334,
                        nonAdminUser,
                        undefined
                    )
                    await expect(addPrograms(nonAdminUser)).to.be.rejectedWith(
                        errorMessage
                    )
                })

                await checkNoChangesMade(false)
            }
        )
    })

    describe('RemoveProgramsFromClasses', () => {
        let admin: User
        let memberWithPermission: User
        let memberWithoutPermission: User
        let nonMember: User
        let orgsData: OrgsData[]
        let programsKept: Map<string, Program[]>
        let classesBefore: Map<string, Class>
        const orgsCount = 2
        const programsCount = 4

        const removeProgramsFromResolver = async (
            user: User,
            input: RemoveProgramsFromClassInput[]
        ) => {
            const permissions = new UserPermissions(userToPayload(user))
            return mutate(RemoveProgramsFromClasses, { input }, permissions)
        }

        const expectRemovePrograms = async (
            user: User,
            input: RemoveProgramsFromClassInput[]
        ) => {
            const { classes } = await removeProgramsFromResolver(user, input)

            for (const [i, cls] of classes.entries()) {
                const inputRelated = input[i]
                expect(cls.id).to.eq(inputRelated.classId)
            }

            const classesDB = await Class.findByIds(input.map((i) => i.classId))

            expect(classes).to.have.lengthOf(input.length)
            expect(classesDB).to.not.be.empty

            for (const cdb of classesDB) {
                const classRelated = classes.find((c) => c.id === cdb.class_id)!
                const classBefore = classesBefore.get(cdb.class_id)!

                expect(classRelated).to.exist
                expect(cdb.class_name).to.eq(classRelated.name)
                expect(cdb.status).to.eq(classRelated.status)

                expect(cdb.class_name).to.eq(classBefore.class_name)
                expect(cdb.status).to.eq(classBefore.status)

                const programIds = (await cdb.programs)!.map((p) => p.id)
                const programsRelatedIds = programsKept
                    .get(cdb.class_id)!
                    .map((p) => p.id)

                expect(programIds).to.have.lengthOf(programsRelatedIds.length)
                expect(programIds).to.deep.equalInAnyOrder(programsRelatedIds)
            }
        }

        const buildDefaultInput = (classes: ClassSpecs[]) => {
            return Array.from(classes, (c) => {
                return {
                    classId: c.class.class_id,
                    programIds: c.progsToRemove.map((p) => p.id),
                }
            })
        }

        const expectNoRemoves = async (classes: Class[]) => {
            const classesDB = await Class.findByIds(
                classes.map((c) => c.class_id)
            )

            expect(classesDB).to.have.lengthOf(classes.length)

            for (const cdb of classesDB) {
                const cls = classes.find((c) => c.class_id === cdb.class_id)!
                const programsDBIds = (await cdb.programs)!.map((p) => p.id)
                const programIds = (await cls.programs)!.map((p) => p.id)

                expect(programsDBIds).to.have.lengthOf(programIds.length)
                expect(programsDBIds).to.deep.equalInAnyOrder(programIds)
            }
        }

        const expectPermissionError = async (
            caller: User,
            input: RemoveProgramsFromClassInput[]
        ) => {
            const permError = permErrorMeta(PermissionName.edit_class_20334)

            const operation = removeProgramsFromResolver(caller, input)
            await expect(operation).to.be.rejectedWith(permError(caller))
        }

        const expectInputErrors = async (
            input: RemoveProgramsFromClassInput[],
            expectedErrors: APIError[]
        ) => {
            const operation = removeProgramsFromResolver(admin, input)
            await expectAPIErrorCollection(
                operation,
                new APIErrorCollection(expectedErrors)
            )
        }

        const resetProgramsInClasses = async (classes: ClassSpecs[]) => {
            classes.forEach((c) => {
                c.class.programs = Promise.resolve([
                    ...c.progsToKeep,
                    ...c.progsToRemove,
                ])
            })

            await Class.save(classes.map((c) => c.class))
        }

        const createPermissionMemberships = async (
            org: Organization,
            role: Role
        ) => {
            await createOrganizationMembership({
                user: memberWithPermission,
                organization: org,
                roles: [role],
            }).save()

            await createOrganizationMembership({
                user: memberWithoutPermission,
                organization: org,
            }).save()
        }

        beforeEach(async () => {
            admin = await adminUserFactory().save()
            memberWithPermission = await createUser().save()
            memberWithoutPermission = await createUser().save()
            nonMember = await createUser().save()

            const roleForRemovePrograms = await createRoleFactory(
                'Remove Programs from Classes',
                undefined,
                { permissions: [PermissionName.edit_class_20334] },
                true
            ).save()

            orgsData = []

            for (let i = 0; i < orgsCount; i += 1) {
                const org = createOrganization()
                const programs = Array.from(new Array(programsCount), () =>
                    createProgram(org)
                )

                const cls = createClassFactory(undefined, org)
                const progsToRemove = programs.slice(0, 2)
                const progsToKeep = programs.slice(2, programs.length)
                cls.programs = Promise.resolve(programs)

                const classes = [{ class: cls, progsToRemove, progsToKeep }]
                orgsData.push({ org, programs, classes })
            }

            await Organization.save(orgsData.map((d) => d.org))
            await Program.save(orgsData.map((d) => d.programs).flat())
            const savedClasses = await Class.save(
                orgsData.map((d) => d.classes.map((c) => c.class)).flat()
            )

            const classSpecsSaved = orgsData.map((d) => d.classes).flat()

            classesBefore = new Map(savedClasses.map((c) => [c.class_id, c]))
            programsKept = new Map(
                classSpecsSaved.map((css) => [
                    css.class.class_id,
                    css.progsToKeep,
                ])
            )

            await createPermissionMemberships(
                orgsData[0].org,
                roleForRemovePrograms
            )
        })

        context('permissions', () => {
            context('successful cases', () => {
                context('when caller is not admin', () => {
                    context('but has permission', () => {
                        it('should remove programs from classes in their organization', async () => {
                            const classesToUse = orgsData[0].classes
                            const input = buildDefaultInput(classesToUse)
                            await expectRemovePrograms(
                                memberWithPermission,
                                input
                            )
                        })
                    })
                })
            })

            context('error handling', () => {
                context('when caller is not admin', () => {
                    context('but has permissions', () => {
                        context(
                            'and tries to remove programs from classes in an organization which does not belong',
                            () => {
                                it('should throw a permission error', async () => {
                                    const classesToUse = orgsData[1].classes
                                    const input = buildDefaultInput(
                                        classesToUse
                                    )

                                    await expectPermissionError(
                                        memberWithPermission,
                                        input
                                    )

                                    await expectNoRemoves(
                                        classesToUse.map((c) => c.class)
                                    )
                                })
                            }
                        )
                    })

                    context('and has not permission', () => {
                        context('but has membership', () => {
                            context(
                                'and tries to remove programs from classes in the organization which belongs',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const classesToUse = orgsData[0].classes
                                        const input = buildDefaultInput(
                                            classesToUse
                                        )

                                        await expectPermissionError(
                                            memberWithoutPermission,
                                            input
                                        )

                                        await expectNoRemoves(
                                            classesToUse.map((c) => c.class)
                                        )
                                    })
                                }
                            )
                        })

                        context('also has not membership', () => {
                            context(
                                'and tries to remove programs from classes in any organization',
                                () => {
                                    it('should throw a permission error', async () => {
                                        const classesToUse = orgsData
                                            .map((d) => d.classes)
                                            .flat()

                                        const input = buildDefaultInput(
                                            classesToUse
                                        )

                                        await expectPermissionError(
                                            nonMember,
                                            input
                                        )

                                        await expectNoRemoves(
                                            classesToUse.map((c) => c.class)
                                        )
                                    })
                                }
                            )
                        })
                    })
                })
            })
        })

        context('inputs', () => {
            context("when 'programIds' has duplicated ids", () => {
                it('should throw an ErrorCollection', async () => {
                    const classesToUse = orgsData[0].classes
                    const input = buildDefaultInput(classesToUse)
                    const inputIndex = 0
                    const programIdToDuplicate = input[inputIndex].programIds[0]
                    input[inputIndex].programIds = [
                        programIdToDuplicate,
                        programIdToDuplicate,
                    ]

                    const expectedErrors = [
                        createDuplicateAttributeAPIError(
                            inputIndex,
                            ['programIds'],
                            'RemoveProgramsFromClassInput'
                        ),
                    ]

                    await expectInputErrors(input, expectedErrors)
                    await expectNoRemoves(classesToUse.map((c) => c.class))
                })
            })

            context("when program in 'programIds' does not exists", () => {
                it('should throw an ErrorCollection', async () => {
                    const nonExistentId = NIL_UUID
                    const classesToUse = orgsData[0].classes
                    const input = buildDefaultInput(classesToUse)
                    const inputIndex = 0
                    input[inputIndex].programIds.push(nonExistentId)

                    const expectedErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            inputIndex,
                            'Program',
                            nonExistentId
                        ),
                    ]

                    await expectInputErrors(input, expectedErrors)
                    await expectNoRemoves(classesToUse.map((c) => c.class))
                })
            })

            context("when program in 'programIds' is inactive", () => {
                let classesToUse: ClassSpecs[]
                let inactiveProg: Program
                const inputIndex = 0

                beforeEach(async () => {
                    classesToUse = orgsData[0].classes
                    inactiveProg = classesToUse[inputIndex].progsToRemove[0]
                    await inactiveProg.inactivate()
                    await inactiveProg.save()
                })

                it('should throw an ErrorCollection', async () => {
                    const input = buildDefaultInput(classesToUse)
                    const expectedErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            inputIndex,
                            'Program',
                            inactiveProg.id
                        ),
                    ]

                    await expectInputErrors(input, expectedErrors)
                    await expectNoRemoves(classesToUse.map((c) => c.class))
                })
            })

            context(
                "when program in 'programIds' doesn't exist for that class",
                () => {
                    it('should throw an ErrorCollection', async () => {
                        const classesToUse = orgsData[0].classes
                        const progToCopy = orgsData[1].programs[0]
                        const input = buildDefaultInput(classesToUse)
                        const inputIndex = 0
                        input[inputIndex].programIds.push(progToCopy.id)

                        const expectedErrors = [
                            createEntityAPIError(
                                'nonExistentChild',
                                inputIndex,
                                'Program',
                                progToCopy.id,
                                'Class',
                                classesToUse[inputIndex].class.class_id
                            ),
                        ]

                        await expectInputErrors(input, expectedErrors)
                        await expectNoRemoves(classesToUse.map((c) => c.class))
                    })
                }
            )
        })

        context('calls to DB', () => {
            it('should do the same DB calls for remove programs from 1 or 4 classes', async () => {
                const classesToUse = orgsData.map((d) => d.classes).flat()
                let input = buildDefaultInput(classesToUse)

                // warm up permission caches
                await removeProgramsFromResolver(admin, input)
                await resetProgramsInClasses(classesToUse)

                input = buildDefaultInput([classesToUse[0]])
                connection.logger.reset()
                await removeProgramsFromResolver(admin, input)
                const oneClassDBCalls = connection.logger.count
                await resetProgramsInClasses(classesToUse)

                input = buildDefaultInput(classesToUse)
                connection.logger.reset()
                await removeProgramsFromResolver(admin, input)
                const fourClassesDBCalls = connection.logger.count

                expect(oneClassDBCalls).to.equal(fourClassesDBCalls)
            })
        })
    })

    describe('AddStudentsToClasses', () => {
        let input: AddStudentsToClassInput[]
        let org: Organization
        let students: User[]
        let classes: Class[]
        let adminUser: User
        let nonAdminUser: User

        function getAddStudents(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return new AddStudentsToClasses([], permissions)
        }

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            adminUser = await createAdminUser(testClient)
            org = await createOrganization().save()
            students = createUsers(3)
            classes = createClasses(3)
            classes.forEach((c) => (c.organization = Promise.resolve(org)))
            await connection.manager.save([...students, ...classes])

            for (let x = 0; x < students.length; x++) {
                await createOrganizationMembership({
                    user: students[x],
                    organization: org,
                    roles: [],
                }).save()
            }
            // Generate input
            input = []
            const inputStudentIndices = [
                [0, 1],
                [1, 2],
                [0, 1, 2],
            ]
            for (let i = 0; i < 3; i++) {
                input.push({
                    classId: classes[i].class_id,
                    studentIds: inputStudentIndices[i].map(
                        (st) => students[st].user_id
                    ),
                })
            }
        })

        context('.run', () => {
            it('makes constant number of queries regardless of input length', async () => {
                const mutation = getAddStudents()
                connection.logger.reset()
                await mutation.generateEntityMaps([input[0]])
                const countForOneInput = connection.logger.count
                connection.logger.reset()
                await mutation.generateEntityMaps(input.slice(0))
                const countForThree = connection.logger.count
                expect(countForThree).to.eq(countForOneInput)
            })
            it('returns the expected output', async () => {
                input = [
                    {
                        classId: classes[0].class_id,
                        studentIds: [students[0].user_id],
                    },
                ]

                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutationResult = mutate(
                    AddStudentsToClasses,
                    { input },
                    permissions
                )

                const {
                    classes: classesNodes,
                }: ClassesMutationResult = await expect(mutationResult).to.be
                    .fulfilled
                expect(classesNodes).to.have.length(1)
                expect(classesNodes[0]).to.deep.eq(
                    mapClassToClassConnectionNode(classes[0])
                )
            })
        })

        context('.generateEntityMaps', () => {
            context('populates the maps correctly', () => {
                let maps: AddStudentsClassesEntityMap

                beforeEach(async () => {
                    const permissions = new UserPermissions(
                        userToPayload(adminUser)
                    )

                    const mutation = new AddStudentsToClasses(
                        input,
                        permissions
                    )
                    maps = await mutation.generateEntityMaps(input)
                })

                it('populates students correctly', () => {
                    it('popualtes classesStudents correctly', () => {
                        expect(
                            Array.from(
                                maps.classesStudents.entries()
                            ).map(([classId, students]) => [
                                classId,
                                students.map((st) => st.user_id),
                            ])
                        ).to.deep.equalInAnyOrder([
                            input.map((i) => [i.classId, [...i.studentIds]]),
                        ])
                    })
                })

                it('populates organizations correctly', () => {
                    expect(maps.organizationIds).to.deep.equalInAnyOrder([
                        org.organization_id,
                        org.organization_id,
                        org.organization_id,
                    ])
                })
            })
        })

        context('.authorize', () => {
            async function authorize(authUser = adminUser) {
                const mutation = getAddStudents(authUser)
                const maps = await mutation.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            const permission = PermissionName.add_students_to_class_20225
            context(
                'when user has permissions to add students to all classes',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await createRoleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createOrganizationMembership({
                            user: nonAdminUser,
                            organization: org,
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('completes successfully', async () => {
                        await expect(authorize(nonAdminUser)).to.be.fulfilled
                    })
                }
            )

            context(
                'when user does not have permissions to add students to all classes',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await createRoleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                    })

                    it('returns a permission error', async () => {
                        await expect(
                            authorize(nonAdminUser)
                        ).to.be.rejectedWith(
                            buildPermissionError(permission, nonAdminUser, [
                                org,
                            ])
                        )
                    })
                }
            )
        })

        context('.validationOverAllInputs', () => {
            context('when the same input is used three times', () => {
                beforeEach(() => {
                    input = [input[0], input[0], input[0]]
                })

                it('returns duplicate errors for the last two inputs', () => {
                    const val = getAddStudents().validationOverAllInputs(input)

                    const expectedErrors = [1, 2].map((inputIndex) =>
                        createDuplicateAttributeAPIError(
                            inputIndex,
                            ['classId'],
                            'AddStudentsToClassInput'
                        )
                    )
                    compareMultipleErrors(val.apiErrors, expectedErrors)
                })

                it('returns only the first input', () => {
                    const val = getAddStudents().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(0)
                    expect(val.validInputs[0].input).to.deep.equal(input[0])
                })
            })

            context('when there are too many studentIds', () => {
                beforeEach(async () => {
                    const tooManyStudents = createUsers(
                        config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                    )
                    await User.save(tooManyStudents)
                    input[0].studentIds = tooManyStudents.map(
                        (student) => student.user_id
                    )
                    input[2].studentIds = tooManyStudents.map(
                        (student) => student.user_id
                    )
                })

                it('returns an error', async () => {
                    const val = getAddStudents().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(1)
                    expect(val.validInputs[0].input).to.deep.equal(input[1])
                    const xErrors = [0, 2].map((i) =>
                        createInputLengthAPIError(
                            'AddStudentsToClassInput',
                            'max',
                            'studentIds',
                            i
                        )
                    )
                    compareMultipleErrors(val.apiErrors, xErrors)
                })
            })

            context(
                'when there are duplicated studentIds in a single input elemnet',
                () => {
                    beforeEach(async () => {
                        input[0].studentIds = [
                            input[0].studentIds[0],
                            input[0].studentIds[0],
                        ]
                        input[2].studentIds = [
                            input[2].studentIds[0],
                            input[2].studentIds[0],
                        ]
                    })

                    it('returns an error', async () => {
                        const val = getAddStudents().validationOverAllInputs(
                            input
                        )
                        expect(val.validInputs).to.have.length(1)
                        expect(val.validInputs[0].index).to.equal(1)
                        expect(val.validInputs[0].input).to.deep.equal(input[1])
                        const xErrors = [0, 2].map((i) =>
                            createDuplicateAttributeAPIError(
                                i,
                                ['studentIds'],
                                'AddStudentsToClassInput'
                            )
                        )
                        compareMultipleErrors(val.apiErrors, xErrors)
                    })
                }
            )
        })

        context('.validate', () => {
            async function validate(
                mutationInput: AddStudentsToClassInput,
                index: number
            ) {
                const mutation = getAddStudents()
                const maps = await mutation.generateEntityMaps([mutationInput])
                return mutation.validate(0, classes[index], mutationInput, maps)
            }

            it('returns no errors when all inputs are valid', async () => {
                const apiErrors = await validate(input[0], 0)
                expect(apiErrors).to.be.length(0)
            })

            context(
                'when one of the students is already part of the class',
                async () => {
                    beforeEach(async () => {
                        classes[0].students = Promise.resolve([students[0]])
                        await classes[0].save()
                    })

                    it('returns existent errors', async () => {
                        const actualErrors = await validate(input[0], 0)
                        const expectedError = createEntityAPIError(
                            'existent',
                            0,
                            'User',
                            input[0].studentIds[0]
                        )

                        expect(actualErrors.length).to.eq(1)
                        compareErrors(actualErrors[0], expectedError)
                    })
                }
            )

            context('when one of the students is inactive', async () => {
                beforeEach(() => students[1].inactivate(getManager()))

                it('returns nonexistent_entity and nonExistentChild errors', async () => {
                    const errors = await validate(input[0], 0)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            students[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            students[1].user_id,
                            'Organization',
                            org.organization_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        classes[1].inactivate(getManager()),
                        students[1].inactivate(getManager()),
                    ])
                })

                it('returns several nonexistent_entity errors', async () => {
                    const errors = await validate(input[1], 1)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'Class',
                            classes[1].class_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            students[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            students[1].user_id,
                            'Organization',
                            org.organization_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })
        })

        context('.process', () => {
            async function process(mutationInput: AddStudentsToClassInput) {
                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutation = new AddStudentsToClasses(
                    [mutationInput],
                    permissions
                )
                const maps = await mutation.generateEntityMaps([mutationInput])
                return {
                    mutationResult: mutation.process(mutationInput, maps, 0),
                    originalClass: maps.mainEntity.get(mutationInput.classId)!,
                    originalStudents: maps.classesStudents.get(
                        mutationInput.classId
                    ),
                }
            }

            it('includes existing students', async () => {
                classes[0].students = Promise.resolve([students[0]])
                await classes[0].save()
                input[0].studentIds = []

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                    originalStudents,
                } = await process(input[0])
                expect(originalClass).to.deep.eq(outputEntity)
                expect(originalStudents).to.deep.equalInAnyOrder(
                    await originalClass.students
                )
            })

            it('adds new students', async () => {
                classes[0].students = Promise.resolve([students[0]])
                await classes[0].save()
                const newStudents = [students[1], students[2]]
                input[0].studentIds = newStudents.map((s) => s.user_id)

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                    originalStudents,
                } = await process(input[0])
                expect(originalClass).to.deep.eq(outputEntity)
                expect(
                    [...originalStudents!, ...newStudents].map(
                        (st) => st.user_id
                    )
                ).to.deep.equalInAnyOrder(
                    (await originalClass.students!).map((st) => st.user_id)
                )
            })
        })
    })

    describe('RemoveStudentsFromClasses', () => {
        let input: RemoveStudentsFromClassInput[]
        let org: Organization
        let students: User[]
        let classes: Class[]
        let adminUser: User
        let nonAdminUser: User

        function getRemoveStudents(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return new RemoveStudentsFromClasses([], permissions)
        }

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            adminUser = await createAdminUser(testClient)
            org = await createOrganization().save()
            students = createUsers(3)
            classes = createClasses(3)
            classes.forEach((c) => (c.organization = Promise.resolve(org)))
            await connection.manager.save([...students, ...classes])

            classes[0].students = Promise.resolve([students[0], students[1]])
            classes[1].students = Promise.resolve([students[1], students[2]])
            classes[2].students = Promise.resolve([
                students[0],
                students[1],
                students[2],
            ])
            await connection.manager.save(classes)
            for (let x = 0; x < students.length; x++) {
                await createOrganizationMembership({
                    user: students[x],
                    organization: org,
                    roles: [],
                }).save()
            }
            // Generate input
            input = []
            const inputStudentIndices = [
                [0, 1],
                [1, 2],
                [0, 1, 2],
            ]
            for (let i = 0; i < 3; i++) {
                input.push({
                    classId: classes[i].class_id,
                    studentIds: inputStudentIndices[i].map(
                        (st) => students[st].user_id
                    ),
                })
            }
        })

        context('.run', () => {
            it('makes constant number of queries regardless of input length', async () => {
                const mutation = getRemoveStudents()
                connection.logger.reset()
                await mutation.generateEntityMaps([input[0]])
                const countForOneInput = connection.logger.count
                connection.logger.reset()
                await mutation.generateEntityMaps(input.slice(0))
                const countForThree = connection.logger.count
                expect(countForThree).to.eq(countForOneInput)
            })
            it('returns the expected output', async () => {
                input = [
                    {
                        classId: classes[0].class_id,
                        studentIds: [students[0].user_id],
                    },
                ]

                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutationResult = mutate(
                    RemoveStudentsFromClasses,
                    { input },
                    permissions
                )

                const {
                    classes: classesNodes,
                }: ClassesMutationResult = await expect(mutationResult).to.be
                    .fulfilled
                expect(classesNodes).to.have.length(1)
                expect(classesNodes[0]).to.deep.eq(
                    mapClassToClassConnectionNode(classes[0])
                )
            })
        })

        context('.generateEntityMaps', () => {
            context('populates the maps correctly', () => {
                let maps: RemoveStudentsClassesEntityMap

                beforeEach(async () => {
                    const permissions = new UserPermissions(
                        userToPayload(adminUser)
                    )

                    const mutation = new RemoveStudentsFromClasses(
                        input,
                        permissions
                    )
                    maps = await mutation.generateEntityMaps(input)
                })

                it('populates classesStudents correctly', () => {
                    it('populates classesStudents correctly', () => {
                        expect(
                            Array.from(
                                maps.classesStudents.entries()
                            ).map(([classId, students]) => [
                                classId,
                                students.map((st) => st.user_id),
                            ])
                        ).to.deep.equalInAnyOrder([
                            input.map((i) => [i.classId, [...i.studentIds]]),
                        ])
                    })
                })

                it('populates organizations correctly', () => {
                    expect(maps.organizationIds).to.deep.equalInAnyOrder([
                        org.organization_id,
                        org.organization_id,
                        org.organization_id,
                    ])
                })
            })
        })

        context('.authorize', () => {
            async function authorize(authUser = adminUser) {
                const mutation = getRemoveStudents(authUser)
                const maps = await mutation.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            const permission =
                PermissionName.delete_student_from_class_roster_20445
            context(
                'when user has permissions to remove students from all classes',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await createRoleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createOrganizationMembership({
                            user: nonAdminUser,
                            organization: org,
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('completes successfully', async () => {
                        await expect(authorize(nonAdminUser)).to.be.fulfilled
                    })
                }
            )

            context(
                'when user does not have permissions to remove students from all classes',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await createRoleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                    })

                    it('returns a permission error', async () => {
                        await expect(
                            authorize(nonAdminUser)
                        ).to.be.rejectedWith(
                            buildPermissionError(permission, nonAdminUser, [
                                org,
                            ])
                        )
                    })
                }
            )
        })

        context('.validationOverAllInputs', () => {
            context('when the same input is used three times', () => {
                beforeEach(() => {
                    input = [input[0], input[0], input[0]]
                })

                it('returns duplicate errors for the last two inputs', () => {
                    const val = getRemoveStudents().validationOverAllInputs(
                        input
                    )

                    const expectedErrors = [1, 2].map((inputIndex) =>
                        createDuplicateAttributeAPIError(
                            inputIndex,
                            ['classId'],
                            'RemoveStudentsFromClassInput'
                        )
                    )
                    compareMultipleErrors(val.apiErrors, expectedErrors)
                })

                it('returns only the first input', () => {
                    const val = getRemoveStudents().validationOverAllInputs(
                        input
                    )
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(0)
                    expect(val.validInputs[0].input).to.deep.equal(input[0])
                })
            })

            context('when there are too many studentIds', () => {
                beforeEach(async () => {
                    const tooManyStudents = createUsers(
                        config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                    )
                    await User.save(tooManyStudents)
                    input[0].studentIds = tooManyStudents.map(
                        (student) => student.user_id
                    )
                    input[2].studentIds = tooManyStudents.map(
                        (student) => student.user_id
                    )
                })

                it('returns an error', async () => {
                    const val = getRemoveStudents().validationOverAllInputs(
                        input
                    )
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(1)
                    expect(val.validInputs[0].input).to.deep.equal(input[1])
                    const xErrors = [0, 2].map((i) =>
                        createInputLengthAPIError(
                            'RemoveStudentsFromClassInput',
                            'max',
                            'studentIds',
                            i
                        )
                    )
                    compareMultipleErrors(val.apiErrors, xErrors)
                })
            })

            context(
                'when there are duplicated studentIds in a single input elemnet',
                () => {
                    beforeEach(async () => {
                        input[0].studentIds = [
                            input[0].studentIds[0],
                            input[0].studentIds[0],
                        ]
                        input[2].studentIds = [
                            input[2].studentIds[0],
                            input[2].studentIds[0],
                        ]
                    })

                    it('returns an error', async () => {
                        const val = getRemoveStudents().validationOverAllInputs(
                            input
                        )
                        expect(val.validInputs).to.have.length(1)
                        expect(val.validInputs[0].index).to.equal(1)
                        expect(val.validInputs[0].input).to.deep.equal(input[1])
                        const xErrors = [0, 2].map((i) =>
                            createDuplicateAttributeAPIError(
                                i,
                                ['studentIds'],
                                'RemoveStudentsFromClassInput'
                            )
                        )
                        compareMultipleErrors(val.apiErrors, xErrors)
                    })
                }
            )
        })

        context('.validate', () => {
            async function validate(
                mutationInput: RemoveStudentsFromClassInput,
                index: number
            ) {
                const mutation = getRemoveStudents()
                const maps = await mutation.generateEntityMaps([mutationInput])
                return mutation.validate(0, classes[index], mutationInput, maps)
            }

            it('returns no errors when all inputs are valid', async () => {
                const apiErrors = await validate(input[0], 0)
                expect(apiErrors).to.be.length(0)
            })

            context(
                'when one of the students is not part of the class',
                async () => {
                    beforeEach(async () => {
                        input[0].studentIds.push(students[2].user_id)
                    })

                    it('returns existent errors', async () => {
                        const actualErrors = await validate(input[0], 0)
                        const expectedError = createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            students[2].user_id,
                            'Class',
                            classes[0].class_id
                        )

                        expect(actualErrors.length).to.eq(1)
                        compareErrors(actualErrors[0], expectedError)
                    })
                }
            )

            context('when one of the students is inactive', async () => {
                beforeEach(() => students[1].inactivate(getManager()))

                it('returns nonexistent_entity and nonExistentChild errors', async () => {
                    const errors = await validate(input[0], 0)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            students[1].user_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        classes[1].inactivate(getManager()),
                        students[1].inactivate(getManager()),
                    ])
                })

                it('returns several nonexistent_entity errors', async () => {
                    const errors = await validate(input[1], 1)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'Class',
                            classes[1].class_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            students[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            students[1].user_id,
                            'Class',
                            classes[1].class_id
                        ),
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            students[2].user_id,
                            'Class',
                            classes[1].class_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })
        })

        context('.process', () => {
            async function process(
                mutationInput: RemoveStudentsFromClassInput
            ) {
                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutation = new RemoveStudentsFromClasses(
                    [mutationInput],
                    permissions
                )
                const maps = await mutation.generateEntityMaps([mutationInput])
                return {
                    mutationResult: mutation.process(mutationInput, maps, 0),
                    originalClass: maps.mainEntity.get(mutationInput.classId)!,
                    originalStudents: maps.classesStudents.get(
                        mutationInput.classId
                    ),
                }
            }

            it('keeps the not removed students', async () => {
                classes[0].students = Promise.resolve([students[0]])
                await classes[0].save()
                input[0].studentIds = []

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                    originalStudents,
                } = await process(input[0])
                expect(originalClass).to.deep.eq(outputEntity)
                expect(originalStudents).to.deep.equalInAnyOrder(
                    await originalClass.students
                )
            })

            it('removes the students', async () => {
                const studentsToRemove = [students[1]]
                input[0].studentIds = studentsToRemove.map((s) => s.user_id)

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                } = await process(input[0])
                expect(await outputEntity.students).to.deep.equalInAnyOrder(
                    await originalClass.students
                )
            })
        })
    })

    describe('AddTeachersToClasses', () => {
        let input: AddTeachersToClassInput[]
        let org: Organization
        let teachers: User[]
        let classes: Class[]
        let adminUser: User
        let nonAdminUser: User

        function getAddTeachers(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return new AddTeachersToClasses([], permissions)
        }

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            adminUser = await createAdminUser(testClient)
            org = await createOrganization().save()
            teachers = await User.save(createUsers(3))
            classes = await Class.save(createClasses(3, org))

            await OrganizationMembership.save(
                Array.from(teachers, (teacher) =>
                    createOrganizationMembership({
                        user: teacher,
                        organization: org,
                        roles: [],
                    })
                )
            )
            // Generate input
            input = []
            const inputTeacherIndices = [
                [0, 1],
                [1, 2],
                [0, 1, 2],
            ]
            for (let i = 0; i < 3; i++) {
                input.push({
                    classId: classes[i].class_id,
                    teacherIds: inputTeacherIndices[i].map(
                        (st) => teachers[st].user_id
                    ),
                })
            }
        })

        context('.run', () => {
            it('makes constant number of queries regardless of input length', async () => {
                const mutation = getAddTeachers()
                connection.logger.reset()
                await mutation.generateEntityMaps([input[0]])
                const countForOneInput = connection.logger.count
                connection.logger.reset()
                await mutation.generateEntityMaps(input.slice(0))
                const countForThree = connection.logger.count
                expect(countForThree).to.eq(countForOneInput)
            })
            it('returns the expected output', async () => {
                input = [
                    {
                        classId: classes[0].class_id,
                        teacherIds: [teachers[0].user_id],
                    },
                ]

                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutationResult = mutate(
                    AddTeachersToClasses,
                    { input },
                    permissions
                )

                const {
                    classes: classesNodes,
                }: ClassesMutationResult = await expect(mutationResult).to.be
                    .fulfilled
                expect(classesNodes).to.have.length(1)
                expect(classesNodes[0]).to.deep.eq(
                    mapClassToClassConnectionNode(classes[0])
                )
            })
        })

        context('.generateEntityMaps', () => {
            context('populates the maps correctly', () => {
                let maps: AddTeachersClassesEntityMap

                beforeEach(async () => {
                    const permissions = new UserPermissions(
                        userToPayload(adminUser)
                    )

                    const mutation = new AddTeachersToClasses(
                        input,
                        permissions
                    )
                    maps = await mutation.generateEntityMaps(input)
                })

                it('populates teachers correctly', () => {
                    it('populates classesTeachers correctly', () => {
                        expect(
                            Array.from(
                                maps.classesTeachers.entries()
                            ).map(([classId, teachers]) => [
                                classId,
                                teachers.map((st) => st.user_id),
                            ])
                        ).to.deep.equalInAnyOrder([
                            input.map((i) => [i.classId, [...i.teacherIds]]),
                        ])
                    })
                })

                it('populates organizations correctly', () => {
                    expect(maps.organizationIds).to.deep.equalInAnyOrder([
                        org.organization_id,
                        org.organization_id,
                        org.organization_id,
                    ])
                })
            })
        })

        context('.authorize', () => {
            async function authorize(authUser = adminUser) {
                const mutation = getAddTeachers(authUser)
                const maps = await mutation.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            const permission = PermissionName.add_teachers_to_class_20226
            context(
                'when user has permissions to add teachers to all classes',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await createRoleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createOrganizationMembership({
                            user: nonAdminUser,
                            organization: org,
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('completes successfully', async () => {
                        await expect(authorize(nonAdminUser)).to.be.fulfilled
                    })
                }
            )

            context(
                'when user does not have permissions to add teachers to all classes',
                () => {
                    it('returns a permission error', async () => {
                        await expect(
                            authorize(nonAdminUser)
                        ).to.be.rejectedWith(
                            buildPermissionError(permission, nonAdminUser, [
                                org,
                            ])
                        )
                    })
                }
            )
        })

        context('.validationOverAllInputs', () => {
            context('when the same input is used three times', () => {
                beforeEach(() => {
                    input = [input[0], input[0], input[0]]
                })

                it('returns duplicate errors for the last two inputs', () => {
                    const val = getAddTeachers().validationOverAllInputs(input)

                    const expectedErrors = [1, 2].map((inputIndex) =>
                        createDuplicateAttributeAPIError(
                            inputIndex,
                            ['classId'],
                            'AddTeachersToClassInput'
                        )
                    )
                    compareMultipleErrors(val.apiErrors, expectedErrors)
                })

                it('returns only the first input', () => {
                    const val = getAddTeachers().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(0)
                    expect(val.validInputs[0].input).to.deep.equal(input[0])
                })
            })

            context('when there are too many teacherIds', () => {
                beforeEach(async () => {
                    const tooManyTeachers = createUsers(
                        config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                    )
                    await User.save(tooManyTeachers)
                    input[0].teacherIds = tooManyTeachers.map(
                        (teacher) => teacher.user_id
                    )
                    input[2].teacherIds = tooManyTeachers.map(
                        (teacher) => teacher.user_id
                    )
                })

                it('returns an error', async () => {
                    const val = getAddTeachers().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(1)
                    expect(val.validInputs[0].input).to.deep.equal(input[1])
                    const xErrors = [0, 2].map((i) =>
                        createInputLengthAPIError(
                            'AddTeachersToClassInput',
                            'max',
                            'teacherIds',
                            i
                        )
                    )
                    compareMultipleErrors(val.apiErrors, xErrors)
                })
            })

            context(
                'when there are duplicated teacherIds in a single input element',
                () => {
                    beforeEach(async () => {
                        input[0].teacherIds = [
                            input[0].teacherIds[0],
                            input[0].teacherIds[0],
                        ]
                        input[2].teacherIds = [
                            input[2].teacherIds[0],
                            input[2].teacherIds[0],
                        ]
                    })

                    it('returns an error', async () => {
                        const val = getAddTeachers().validationOverAllInputs(
                            input
                        )
                        expect(val.validInputs).to.have.length(1)
                        expect(val.validInputs[0].index).to.equal(1)
                        expect(val.validInputs[0].input).to.deep.equal(input[1])
                        const xErrors = [0, 2].map((i) =>
                            createDuplicateAttributeAPIError(
                                i,
                                ['teacherIds'],
                                'AddTeachersToClassInput'
                            )
                        )
                        compareMultipleErrors(val.apiErrors, xErrors)
                    })
                }
            )
        })

        context('.validate', () => {
            async function validate(
                mutationInput: AddTeachersToClassInput,
                index: number
            ) {
                const mutation = getAddTeachers()
                const maps = await mutation.generateEntityMaps([mutationInput])
                return mutation.validate(0, classes[index], mutationInput, maps)
            }

            it('returns no errors when all inputs are valid', async () => {
                const apiErrors = await validate(input[0], 0)
                expect(apiErrors).to.be.length(0)
            })

            context(
                'when one of the teachers is already part of the class',
                async () => {
                    beforeEach(async () => {
                        classes[0].teachers = Promise.resolve([teachers[0]])
                        await classes[0].save()
                    })

                    it('returns existent errors', async () => {
                        const actualErrors = await validate(input[0], 0)
                        const expectedError = createEntityAPIError(
                            'existent',
                            0,
                            'User',
                            input[0].teacherIds[0]
                        )

                        expect(actualErrors.length).to.eq(1)
                        compareErrors(actualErrors[0], expectedError)
                    })
                }
            )

            context('when one of the teachers is inactive', async () => {
                beforeEach(() => teachers[1].inactivate(getManager()))

                it('returns nonexistent_entity and nonExistentChild errors', async () => {
                    const errors = await validate(input[0], 0)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            teachers[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            teachers[1].user_id,
                            'Organization',
                            org.organization_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        classes[1].inactivate(getManager()),
                        teachers[1].inactivate(getManager()),
                    ])
                })

                it('returns several nonexistent_entity errors', async () => {
                    const errors = await validate(input[1], 1)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'Class',
                            classes[1].class_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            teachers[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            teachers[1].user_id,
                            'Organization',
                            org.organization_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })
        })

        context('.process', () => {
            async function process(mutationInput: AddTeachersToClassInput) {
                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutation = new AddTeachersToClasses(
                    [mutationInput],
                    permissions
                )
                const maps = await mutation.generateEntityMaps([mutationInput])
                return {
                    mutationResult: mutation.process(mutationInput, maps, 0),
                    originalClass: maps.mainEntity.get(mutationInput.classId)!,
                    originalTeachers: maps.classesTeachers.get(
                        mutationInput.classId
                    ),
                }
            }

            it('includes existing teachers', async () => {
                classes[0].teachers = Promise.resolve([teachers[0]])
                await classes[0].save()
                input[0].teacherIds = []

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                    originalTeachers,
                } = await process(input[0])
                expect(originalClass).to.deep.eq(outputEntity)
                expect(originalTeachers).to.deep.equalInAnyOrder(
                    await originalClass.teachers
                )
            })

            it('adds new teachers', async () => {
                classes[0].teachers = Promise.resolve([teachers[0]])
                await classes[0].save()
                const newTeachers = [teachers[1], teachers[2]]
                input[0].teacherIds = newTeachers.map((s) => s.user_id)

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                    originalTeachers,
                } = await process(input[0])
                expect(originalClass).to.deep.eq(outputEntity)
                expect(
                    [...originalTeachers!, ...newTeachers].map(
                        (st) => st.user_id
                    )
                ).to.deep.equalInAnyOrder(
                    (await originalClass.teachers!).map((st) => st.user_id)
                )
            })
        })
    })

    describe('RemoveTeachersFromClasses', () => {
        let input: RemoveTeachersFromClassInput[]
        let org: Organization
        let teachers: User[]
        let classes: Class[]
        let adminUser: User
        let nonAdminUser: User

        function getRemoveTeachers(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return new RemoveTeachersFromClasses([], permissions)
        }

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            adminUser = await createAdminUser(testClient)
            org = await createOrganization().save()
            teachers = await User.save(createUsers(3))
            classes = await Class.save(createClasses(3, org))
            classes[0].teachers = Promise.resolve([teachers[0], teachers[1]])
            classes[1].teachers = Promise.resolve([teachers[1], teachers[2]])
            classes[2].teachers = Promise.resolve([
                teachers[0],
                teachers[1],
                teachers[2],
            ])
            await connection.manager.save(classes)
            await OrganizationMembership.save(
                Array.from(teachers, (teacher) =>
                    createOrganizationMembership({
                        user: teacher,
                        organization: org,
                        roles: [],
                    })
                )
            )
            // Generate input
            input = []
            const inputTeacherIndices = [
                [0, 1],
                [1, 2],
                [0, 1, 2],
            ]
            for (let i = 0; i < 3; i++) {
                input.push({
                    classId: classes[i].class_id,
                    teacherIds: inputTeacherIndices[i].map(
                        (st) => teachers[st].user_id
                    ),
                })
            }
        })

        context('.run', () => {
            it('makes constant number of queries regardless of input length', async () => {
                const mutation = getRemoveTeachers()
                connection.logger.reset()
                await mutation.generateEntityMaps([input[0]])
                const countForOneInput = connection.logger.count
                connection.logger.reset()
                await mutation.generateEntityMaps(input.slice(0))
                const countForThree = connection.logger.count
                expect(countForThree).to.eq(countForOneInput)
            })
            it('returns the expected output', async () => {
                input = [
                    {
                        classId: classes[0].class_id,
                        teacherIds: [teachers[0].user_id],
                    },
                ]

                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutationResult = mutate(
                    RemoveTeachersFromClasses,
                    { input },
                    permissions
                )

                const {
                    classes: classesNodes,
                }: ClassesMutationResult = await expect(mutationResult).to.be
                    .fulfilled
                expect(classesNodes).to.have.length(1)
                expect(classesNodes[0]).to.deep.eq(
                    mapClassToClassConnectionNode(classes[0])
                )
            })
        })

        context('.generateEntityMaps', () => {
            context('populates the maps correctly', () => {
                let maps: RemoveTeachersClassesEntityMap

                beforeEach(async () => {
                    const permissions = new UserPermissions(
                        userToPayload(adminUser)
                    )

                    const mutation = new RemoveTeachersFromClasses(
                        input,
                        permissions
                    )
                    maps = await mutation.generateEntityMaps(input)
                })

                it('populates classesTeachers correctly', () => {
                    it('populates classesTeachers correctly', () => {
                        expect(
                            Array.from(
                                maps.classesTeachers.entries()
                            ).map(([classId, teachers]) => [
                                classId,
                                teachers.map((st) => st.user_id),
                            ])
                        ).to.deep.equalInAnyOrder([
                            input.map((i) => [i.classId, [...i.teacherIds]]),
                        ])
                    })
                })

                it('populates organizations correctly', () => {
                    expect(maps.organizationIds).to.deep.equalInAnyOrder([
                        org.organization_id,
                        org.organization_id,
                        org.organization_id,
                    ])
                })
            })
        })

        context('.authorize', () => {
            async function authorize(authUser = adminUser) {
                const mutation = getRemoveTeachers(authUser)
                const maps = await mutation.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            const permission = PermissionName.delete_teacher_from_class_20446
            context(
                'when user has permissions to remove teachers from all classes',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await createRoleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createOrganizationMembership({
                            user: nonAdminUser,
                            organization: org,
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('completes successfully', async () => {
                        await expect(authorize(nonAdminUser)).to.be.fulfilled
                    })
                }
            )

            context(
                'when user does not have permissions to remove teachers from all classes',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await createRoleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                    })

                    it('returns a permission error', async () => {
                        await expect(
                            authorize(nonAdminUser)
                        ).to.be.rejectedWith(
                            buildPermissionError(permission, nonAdminUser, [
                                org,
                            ])
                        )
                    })
                }
            )
        })

        context('.validationOverAllInputs', () => {
            context('when the same input is used three times', () => {
                beforeEach(() => {
                    input = [input[0], input[0], input[0]]
                })

                it('returns duplicate errors for the last two inputs', () => {
                    const val = getRemoveTeachers().validationOverAllInputs(
                        input
                    )

                    const expectedErrors = [1, 2].map((inputIndex) =>
                        createDuplicateAttributeAPIError(
                            inputIndex,
                            ['classId'],
                            'RemoveTeachersFromClassInput'
                        )
                    )
                    compareMultipleErrors(val.apiErrors, expectedErrors)
                })

                it('returns only the first input', () => {
                    const val = getRemoveTeachers().validationOverAllInputs(
                        input
                    )
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(0)
                    expect(val.validInputs[0].input).to.deep.equal(input[0])
                })
            })

            context('when there are too many teacherIds', () => {
                beforeEach(async () => {
                    const tooManyTeachers = createUsers(
                        config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                    )
                    await User.save(tooManyTeachers)
                    input[0].teacherIds = tooManyTeachers.map(
                        (teacher) => teacher.user_id
                    )
                    input[2].teacherIds = tooManyTeachers.map(
                        (teacher) => teacher.user_id
                    )
                })

                it('returns an error', async () => {
                    const val = getRemoveTeachers().validationOverAllInputs(
                        input
                    )
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(1)
                    expect(val.validInputs[0].input).to.deep.equal(input[1])
                    const xErrors = [0, 2].map((i) =>
                        createInputLengthAPIError(
                            'RemoveTeachersFromClassInput',
                            'max',
                            'teacherIds',
                            i
                        )
                    )
                    compareMultipleErrors(val.apiErrors, xErrors)
                })
            })

            context(
                'when there are duplicated teacherIds in a single input elemnet',
                () => {
                    beforeEach(async () => {
                        input[0].teacherIds = [
                            input[0].teacherIds[0],
                            input[0].teacherIds[0],
                        ]
                        input[2].teacherIds = [
                            input[2].teacherIds[0],
                            input[2].teacherIds[0],
                        ]
                    })

                    it('returns an error', async () => {
                        const val = getRemoveTeachers().validationOverAllInputs(
                            input
                        )
                        expect(val.validInputs).to.have.length(1)
                        expect(val.validInputs[0].index).to.equal(1)
                        expect(val.validInputs[0].input).to.deep.equal(input[1])
                        const xErrors = [0, 2].map((i) =>
                            createDuplicateAttributeAPIError(
                                i,
                                ['teacherIds'],
                                'RemoveTeachersFromClassInput'
                            )
                        )
                        compareMultipleErrors(val.apiErrors, xErrors)
                    })
                }
            )
        })

        context('.validate', () => {
            async function validate(
                mutationInput: RemoveTeachersFromClassInput,
                index: number
            ) {
                const mutation = getRemoveTeachers()
                const maps = await mutation.generateEntityMaps([mutationInput])
                return mutation.validate(0, classes[index], mutationInput, maps)
            }

            it('returns no errors when all inputs are valid', async () => {
                const apiErrors = await validate(input[0], 0)
                expect(apiErrors).to.be.length(0)
            })

            context(
                'when one of the teachers is not part of the class',
                async () => {
                    beforeEach(async () => {
                        input[0].teacherIds.push(teachers[2].user_id)
                    })

                    it('returns existent errors', async () => {
                        const actualErrors = await validate(input[0], 0)
                        const expectedError = createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            teachers[2].user_id,
                            'Class',
                            classes[0].class_id
                        )

                        expect(actualErrors.length).to.eq(1)
                        compareErrors(actualErrors[0], expectedError)
                    })
                }
            )

            context('when one of the teachers is inactive', async () => {
                beforeEach(() => teachers[1].inactivate(getManager()))

                it('returns nonexistent_entity and nonExistentChild errors', async () => {
                    const errors = await validate(input[0], 0)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            teachers[1].user_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        classes[1].inactivate(getManager()),
                        teachers[1].inactivate(getManager()),
                    ])
                })

                it('returns several nonexistent_entity errors', async () => {
                    const errors = await validate(input[1], 1)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'Class',
                            classes[1].class_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            teachers[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'User',
                            teachers[2].user_id,
                            'Class',
                            classes[1].class_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })
        })

        context('.process', () => {
            async function process(
                mutationInput: RemoveTeachersFromClassInput
            ) {
                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutation = new RemoveTeachersFromClasses(
                    [mutationInput],
                    permissions
                )
                const maps = await mutation.generateEntityMaps([mutationInput])
                return {
                    mutationResult: mutation.process(mutationInput, maps, 0),
                    originalClass: maps.mainEntity.get(mutationInput.classId)!,
                    originalTeachers: maps.classesTeachers.get(
                        mutationInput.classId
                    ),
                }
            }

            it('keeps the not removed teachers', async () => {
                classes[0].teachers = Promise.resolve([teachers[0]])
                await classes[0].save()
                input[0].teacherIds = []

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                    originalTeachers,
                } = await process(input[0])
                expect(originalClass).to.deep.eq(outputEntity)
                expect(originalTeachers).to.deep.equalInAnyOrder(
                    await originalClass.teachers
                )
            })

            it('removes the teachers', async () => {
                const teachersToRemove = [teachers[1]]
                input[0].teacherIds = teachersToRemove.map((s) => s.user_id)

                const {
                    mutationResult: { outputEntity },
                    originalClass,
                } = await process(input[0])
                expect(await outputEntity.teachers).to.deep.equalInAnyOrder(
                    await originalClass.teachers
                )
            })
        })
    })
})
