import { getConnection } from 'typeorm'
import { createOrganization } from '../factories/organization.factory'
import {
    makeUserWithPermission,
    makeUserWithoutPermissions,
} from '../factories/user.factory'
import { TestConnection } from '../utils/testConnection'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { Organization } from '../../src/entities/organization'
import { AgeRange } from '../../src/entities/ageRange'
import {
    CreateAgeRanges,
    CreateAgeRangesEntityMap,
    DeleteAgeRanges,
} from '../../src/resolvers/ageRange'
import { createAgeRange, createAgeRanges } from '../factories/ageRange.factory'
import {
    AgeRangeConnectionNode,
    CreateAgeRangeInput,
    DeleteAgeRangeInput,
} from '../../src/types/graphQL/ageRange'
import { mutate } from '../../src/utils/resolvers/commonStructure'
import { Status } from '../../src/entities/status'
import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import chaiAsPromised from 'chai-as-promised'
import { buildPermissionError } from '../utils/errors'
import faker from 'faker'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import { APIError } from '../../src/types/errors/apiError'
import { compareMultipleErrors } from '../utils/apiError'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createExistentEntityAttributeAPIError,
} from '../../src/utils/resolvers/errors'
import { customErrors } from '../../src/types/errors/customError'
import { ObjMap } from '../../src/utils/stringUtils'
import { v4 as uuid_v4 } from 'uuid'
import { config } from '../../src/config/config'
import { createInitialData } from '../utils/createTestData'
import { buildPermissionError, permErrorMeta } from '../utils/errors'
import { User } from '../../src/entities/user'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import {
    createDuplicateAttributeAPIError,
    createDuplicateInputAttributeAPIError,
    createEntityAPIError,
} from '../../src/utils/resolvers/errors'
import { compareMultipleErrors } from '../utils/apiError'
import { Role } from '../../src/entities/role'
import { NIL_UUID } from '../utils/database'
import { buildUpdateAgeRangeInputArray } from '../utils/operations/ageRangeOps'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { userToPayload } from '../utils/operations/userOps'

use(deepEqualInAnyOrder)
use(chaiAsPromised)

describe('ageRange', () => {
    let connection: TestConnection
    let admin: User
    let userWithPermission: User
    let userWithoutPermission: User
    let userWithoutMembership: User
    let systemAgeRanges: AgeRange[]
    let org1: Organization
    let org2: Organization
    let org1AgeRanges: AgeRange[]
    let org2AgeRanges: AgeRange[]
    const ageRangesCount = 5
    let ageRangesTotalCount = 0
    let updateAgeRangesRole: Role

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        admin = await createAdminUser().save()
        userWithPermission = await createUser().save()
        userWithoutPermission = await createUser().save()
        userWithoutMembership = await createUser().save()

        // Creating Organizations
        org1 = createOrganization()
        org1.organization_name = 'Organization 1'
        await org1.save()
        org2 = createOrganization()
        org2.organization_name = 'Organization 2'
        await org2.save()

        // Creating Role for update age ranges
        updateAgeRangesRole = await createRole('Update Age Ranges', org1, {
            permissions: [PermissionName.edit_age_range_20332],
        }).save()

        // Assigning userWithPermission to org1 with the role
        await createOrganizationMembership({
            user: userWithPermission,
            organization: org1,
            roles: [updateAgeRangesRole],
        }).save()

        // Assigning userWithoutPermission to org1
        await createOrganizationMembership({
            user: userWithoutPermission,
            organization: org1,
        }).save()
    })

    const createInitialAgeRanges = async () => {
        await AgeRangesInitializer.run()
        systemAgeRanges = await AgeRange.find({ take: ageRangesCount })

        org1AgeRanges = await AgeRange.save(
            Array.from(new Array(ageRangesCount), () => createAgeRange(org1))
        )

        org2AgeRanges = await AgeRange.save(
            Array.from(new Array(ageRangesCount), () => createAgeRange(org2))
        )

        ageRangesTotalCount = await AgeRange.count()
    }

    const createAgeRangesToUse = async (org: Organization) =>
        await AgeRange.save(createAgeRanges(10, org))

    const compareAgeRangeConnectionNodeWithInput = (
        ageRange: AgeRangeConnectionNode,
        input: CreateAgeRangeInput
    ) => {
        expect(ageRange.name).to.eq(input.name)
        expect(ageRange.lowValue).to.eq(input.lowValue)
        expect(ageRange.highValue).to.eq(input.highValue)
        expect(ageRange.lowValueUnit).to.eq(input.lowValueUnit)
        expect(ageRange.highValueUnit).to.eq(input.highValueUnit)
        expect(ageRange.status).to.eq(Status.ACTIVE)
        expect(ageRange.system).to.equal(false)
    }

    const compareDBAgeRangeWithInput = async (
        input: CreateAgeRangeInput,
        dbAgeRange: AgeRange,
        org: Organization
    ) => {
        expect(dbAgeRange.name).to.eq(input.name)
        expect(dbAgeRange.low_value).to.eq(input.lowValue)
        expect(dbAgeRange.high_value).to.eq(input.highValue)
        expect(dbAgeRange.low_value_unit).to.eq(input.lowValueUnit)
        expect(dbAgeRange.high_value_unit).to.eq(input.highValueUnit)
        expect(dbAgeRange.status).to.eq(Status.ACTIVE)
        expect(dbAgeRange.system).to.eq(false)
        expect((await dbAgeRange.organization)?.organization_id).to.eq(
            input.organizationId
        )
    }

    describe('DeleteAgeRanges', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let ageRangesToDelete: AgeRange[]
        let deleteAgeRanges: DeleteAgeRanges

        beforeEach(async () => {
            const data = await createInitialData([
                PermissionName.delete_age_range_20442,
            ])
            org = data.organization
            ctx = data.context
            ageRangesToDelete = await createAgeRangesToUse(org)
            deleteAgeRanges = new DeleteAgeRanges([], ctx.permissions)
        })

        const buildDefaultInput = (
            ageRanges: AgeRange[]
        ): DeleteAgeRangeInput[] =>
            Array.from(ageRanges, ({ id }) => {
                return { id }
            })

        context('complete mutation calls', () => {
            it('can delete an age range', async () => {
                const input = buildDefaultInput([ageRangesToDelete[0]])
                const { ageRanges } = await mutate(
                    DeleteAgeRanges,
                    { input },
                    ctx.permissions
                )

                expect(ageRanges).to.have.lengthOf(1)
                expect(ageRanges[0].id).to.eq(input[0].id)
                expect(ageRanges[0].status).to.eq(Status.INACTIVE)

                const dbAgeRanges = await AgeRange.findByIds([input[0].id])
                expect(dbAgeRanges).to.have.lengthOf(1)
                expect(dbAgeRanges[0].status).to.eq(Status.INACTIVE)
            })

            const getDbCallCount = async (input: DeleteAgeRangeInput[]) => {
                connection.logger.reset()
                await mutate(DeleteAgeRanges, { input }, ctx.permissions)
                return connection.logger.count
            }

            it('makes the same number of db connections regardless of input length', async () => {
                await getDbCallCount(buildDefaultInput([ageRangesToDelete[0]])) // warm up permissions cache)

                const singleAgeRangeCount = await getDbCallCount(
                    buildDefaultInput([ageRangesToDelete[1]])
                )

                const twoAgeRangeCount = await getDbCallCount(
                    buildDefaultInput(ageRangesToDelete.slice(2, 4))
                )

                expect(twoAgeRangeCount).to.be.eq(singleAgeRangeCount)
                expect(twoAgeRangeCount).to.be.equal(2)
            })
        })

        context('authorize', () => {
            const callAuthorize = async (
                userCtx: { permissions: UserPermissions },
                ageRanges: AgeRange[]
            ) => {
                const input = buildDefaultInput(ageRanges)
                const mutation = new DeleteAgeRanges(input, userCtx.permissions)
                const maps = await deleteAgeRanges.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.delete_age_range_20442
                )

                const permittedAgeRange = await createAgeRange(
                    permittedOrg
                ).save()

                await expect(callAuthorize(userCtx, [permittedAgeRange])).to.be
                    .fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const {
                    permittedOrg,
                    userCtx,
                    clientUser,
                } = await makeUserWithPermission(
                    PermissionName.create_age_range_20222
                )

                const permittedAgeRange = await createAgeRange(
                    permittedOrg
                ).save()

                await expect(
                    callAuthorize(userCtx, [permittedAgeRange])
                ).to.be.rejectedWith(
                    buildPermissionError(
                        PermissionName.delete_age_range_20442,
                        clientUser,
                        [permittedOrg]
                    )
                )
            })

            it('rejects to delete a system age range', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.delete_age_range_20442
                )
                const permittedGrade = await createAgeRange(permittedOrg).save()
                const systemGrade = await createAgeRange(
                    undefined,
                    undefined,
                    undefined,
                    true
                ).save()
                await expect(
                    callAuthorize(userCtx, [permittedGrade, systemGrade])
                ).to.be.rejectedWith(
                    'On index 1, You are unauthorized to perform this action.'
                )
            })
        })
    })

    describe('CreateAgeRanges', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let createAgeRanges: CreateAgeRanges

        beforeEach(async () => {
            const data = await createInitialData([
                PermissionName.create_age_range_20222,
            ])

            org = data.organization
            ctx = data.context
            createAgeRanges = new CreateAgeRanges([], ctx.permissions)
        })

        const buildDefaultInput = (quantity: number) => {
            return Array.from(new Array(quantity), () => {
                const lowValue = faker.datatype.number({
                    min: config.limits.AGE_RANGE_LOW_VALUE_MIN,
                    max: config.limits.AGE_RANGE_LOW_VALUE_MAX - 1,
                })
                const highValue = lowValue + 1
                const unit = faker.random.arrayElement(
                    Object.values(AgeRangeUnit)
                )

                return {
                    organizationId: org.organization_id,
                    name: faker.random.word(),
                    lowValue,
                    highValue,
                    highValueUnit: unit,
                    lowValueUnit: unit,
                }
            })
        }

        context('complete mutation calls', () => {
            it('can create an age range', async () => {
                const input: CreateAgeRangeInput[] = buildDefaultInput(1)
                const { ageRanges } = await mutate(
                    CreateAgeRanges,
                    { input },
                    ctx.permissions
                )

                expect(ageRanges).to.have.lengthOf(1)
                expect(ageRanges[0].id).to.not.be.undefined
                compareAgeRangeConnectionNodeWithInput(ageRanges[0], input[0])

                const dbAgeRanges = await AgeRange.findBy({
                    id: ageRanges[0].id,
                })

                expect(dbAgeRanges).to.have.lengthOf(1)
                await compareDBAgeRangeWithInput(input[0], dbAgeRanges[0], org)
            })

            const getDbCallCount = async (input: CreateAgeRangeInput[]) => {
                connection.logger.reset()
                await mutate(CreateAgeRanges, { input }, ctx.permissions)
                return connection.logger.count
            }

            it('db connections do not increase with number of input elements', async () => {
                await getDbCallCount(buildDefaultInput(1)) // warm up permissions cache
                const singleAgeRangeCount = await getDbCallCount(
                    buildDefaultInput(1)
                )

                const twoAgeRangesCount = await getDbCallCount(
                    buildDefaultInput(2)
                )

                expect(singleAgeRangeCount).to.be.eq(twoAgeRangesCount)
                expect(twoAgeRangesCount).to.be.equal(4)
            })
        })

        context('generateEntityMaps', () => {
            const generateExistingAgeRanges = async (org: Organization) => {
                const existingAgeRange = await createAgeRange(org).save()
                const nonPermittedOrgAgeRange = await createAgeRange(
                    await createOrganization().save()
                ).save()

                const inactiveAgeRange = createAgeRange(org)
                inactiveAgeRange.status = Status.INACTIVE
                await inactiveAgeRange.save()

                const inactiveOrg = createOrganization()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()
                const inactiveOrgAgeRange = await createAgeRange(
                    inactiveOrg
                ).save()

                return [
                    existingAgeRange,
                    nonPermittedOrgAgeRange,
                    inactiveAgeRange,
                    inactiveOrgAgeRange,
                ]
            }

            it('returns existing age range names', async () => {
                const existingAgeRanges = await generateExistingAgeRanges(org)
                const expectedPairs = await Promise.all(
                    existingAgeRanges
                        .filter((ar) => ar.status === Status.ACTIVE)
                        .map(async (ar) => {
                            return {
                                organizationId: ar.organization_id!,
                                name: ar.name!,
                            }
                        })
                )

                const input = [
                    ...(await Promise.all(
                        existingAgeRanges.map(async (ar) => {
                            return {
                                organizationId: ar.organization_id!,
                                name: ar.name!,
                                lowValue: ar.low_value,
                                highValue: ar.high_value,
                                lowValueUnit: ar.low_value_unit,
                                highValueUnit: ar.high_value_unit,
                            }
                        })
                    )),
                    ...buildDefaultInput(1),
                ]

                const entityMaps = await createAgeRanges.generateEntityMaps(
                    input
                )

                expect(
                    Array.from(entityMaps.conflictingNames.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
            })

            it('returns existing age range values', async () => {
                const existingAgeRanges = await generateExistingAgeRanges(org)
                const expectedPairs = await Promise.all(
                    existingAgeRanges.map(async (ar) => {
                        return {
                            organizationId: (await ar.organization)!
                                .organization_id,
                            lowValue: ar.low_value,
                            highValue: ar.high_value,
                            lowValueUnit: ar.low_value_unit,
                            highValueUnit: ar.high_value_unit,
                        }
                    })
                )

                const input = [
                    ...(await Promise.all(
                        existingAgeRanges.map(async (ar) => {
                            return {
                                organizationId: (await ar.organization)!
                                    .organization_id,
                                name: ar.name!,
                                lowValue: ar.low_value,
                                highValue: ar.high_value,
                                lowValueUnit: ar.low_value_unit,
                                highValueUnit: ar.high_value_unit,
                            }
                        })
                    )),
                    ...buildDefaultInput(1),
                ]

                const entityMaps = await createAgeRanges.generateEntityMaps(
                    input
                )

                expect(
                    Array.from(entityMaps.conflictingValues.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
            })
        })

        context('authorize', () => {
            const callAuthorize = (
                userCtx: { permissions: UserPermissions },
                orgIds: string[]
            ) => {
                const mutation = new CreateAgeRanges([], userCtx.permissions)
                const input = buildDefaultInput(orgIds.length).map(
                    (inp, idx) => {
                        return { ...inp, organizationId: orgIds[idx] }
                    }
                )

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
                    /User\(.*\) does not have Permission\(create_age_range_20222\) in Organizations\(.*\)/
                )
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_age_range_20222
                )

                await expect(
                    callAuthorize(userCtx, [permittedOrg.organization_id])
                ).to.be.eventually.fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const {
                    organization,
                    userCtx,
                } = await makeUserWithoutPermissions()

                await expectPermissionError(userCtx, [organization])
            })

            it('checks all organizations', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.create_age_range_20222
                )

                const {
                    organization: notPermittedOrg,
                } = await makeUserWithoutPermissions()

                await expectPermissionError(userCtx, [
                    permittedOrg,
                    notPermittedOrg,
                ])
            })
        })

        context('validationOverAllInputs', () => {
            let inputs: CreateAgeRangeInput[]

            beforeEach(() => {
                inputs = buildDefaultInput(3)
            })

            const expectInputsValidation = (
                input: CreateAgeRangeInput[],
                expectedErrors: APIError[]
            ) => {
                const {
                    validInputs,
                    apiErrors,
                } = createAgeRanges.validationOverAllInputs(input)

                const failedInputIndexes = new Set(
                    apiErrors.map((err) => err.index)
                )

                const inputsWithoutErrors = input
                    .map((i, index) => {
                        return {
                            ...i,
                            index,
                        }
                    })
                    .filter((i) => !failedInputIndexes.has(i.index))

                expect(validInputs).to.have.lengthOf(inputsWithoutErrors.length)

                validInputs.forEach((vi, i) => {
                    const relatedInput = inputsWithoutErrors[i]
                    expect(vi.input.name).to.eq(relatedInput.name)
                    expect(vi.index).to.eq(relatedInput.index)
                })

                expect(apiErrors.length).to.eq(expectedErrors.length)
                compareMultipleErrors(apiErrors, expectedErrors)
            }

            it("checks if exist 'name' duplicates for the same 'organizationId'", async () => {
                const duplicateInput = inputs[1]
                duplicateInput.name = inputs[0].name

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['name'],
                    'ageRange'
                )

                expectInputsValidation(inputs, [error])
            })

            it("checks if exist ('lowValue', 'highValue', 'lowValueUnit', and 'highValueUnit') duplicates for the same 'organizationId'", async () => {
                const duplicateInput = inputs[1]
                duplicateInput.lowValue = inputs[0].lowValue
                duplicateInput.highValue = inputs[0].highValue
                duplicateInput.lowValueUnit = inputs[0].lowValueUnit
                duplicateInput.highValueUnit = inputs[0].highValueUnit

                const error = createDuplicateAttributeAPIError(
                    1,
                    ['lowValue', 'lowValueUnit', 'highValue', 'highValueUnit'],
                    'ageRange'
                )

                expectInputsValidation(inputs, [error])
            })

            it("checks if 'lowValue' is greater than or equal 'highValue'", async () => {
                const errorInput = inputs[1]
                errorInput.lowValue = errorInput.highValue

                const error = new APIError({
                    code: customErrors.comparing_values.code,
                    message: customErrors.comparing_values.message,
                    entity: 'ageRange',
                    attribute: 'lowValue',
                    otherAttribute: 'highValue',
                    comparison: 'less than',
                    variables: ['lowValue', 'highValue'],
                    index: 1,
                })

                expectInputsValidation(inputs, [error])
            })

            it("checks if 'lowValue' is out of the range of 0 to 99, limits included", async () => {
                const errorInput = inputs[1]
                errorInput.lowValue = config.limits.AGE_RANGE_LOW_VALUE_MIN - 1

                const error = new APIError({
                    code: customErrors.not_in_inclusive_range.code,
                    message: customErrors.not_in_inclusive_range.message,
                    entity: 'ageRange',
                    attribute: 'lowValue',
                    min: config.limits.AGE_RANGE_LOW_VALUE_MIN,
                    max: config.limits.AGE_RANGE_LOW_VALUE_MAX,
                    variables: ['lowValue'],
                    index: 1,
                })

                expectInputsValidation(inputs, [error])
            })

            it("checks if 'highValue' is out of the range of 1 to 99, limits included", async () => {
                const errorInput = inputs[1]
                errorInput.highValue =
                    config.limits.AGE_RANGE_HIGH_VALUE_MAX + 1

                const error = new APIError({
                    code: customErrors.not_in_inclusive_range.code,
                    message: customErrors.not_in_inclusive_range.message,
                    entity: 'ageRange',
                    attribute: 'highValue',
                    min: config.limits.AGE_RANGE_HIGH_VALUE_MIN,
                    max: config.limits.AGE_RANGE_HIGH_VALUE_MAX,
                    variables: ['highValue'],
                    index: 1,
                })

                expectInputsValidation(inputs, [error])
            })
        })

        const buildEntityMap = async (ageRangesToUse: AgeRange[] = []) => {
            const entityMap: CreateAgeRangesEntityMap = {
                conflictingNames: new ObjMap([]),
                conflictingValues: new ObjMap([]),
                organizations: new Map([]),
            }

            for await (const ageRange of ageRangesToUse) {
                if (ageRange.id === undefined) {
                    ageRange.id = uuid_v4()
                }

                const ageRangeOrg = (await ageRange.organization)!

                entityMap.organizations.set(
                    ageRangeOrg.organization_id,
                    ageRangeOrg
                )

                entityMap.conflictingNames.set(
                    {
                        organizationId: ageRangeOrg.organization_id,
                        name: ageRange.name!,
                    },
                    ageRange
                )

                entityMap.conflictingValues.set(
                    {
                        organizationId: ageRangeOrg.organization_id,
                        lowValue: ageRange.low_value,
                        highValue: ageRange.high_value,
                        lowValueUnit: ageRange.low_value_unit,
                        highValueUnit: ageRange.high_value_unit,
                    },
                    ageRange
                )
            }

            return entityMap
        }

        context('validate', () => {
            const runTestCases = (
                testCases: { input: CreateAgeRangeInput; error?: APIError }[],
                entityMap: CreateAgeRangesEntityMap
            ) => {
                for (const { input, error } of testCases) {
                    const errors = createAgeRanges.validate(
                        0,
                        undefined,
                        input,
                        entityMap
                    )

                    if (error !== undefined) {
                        compareMultipleErrors(errors, [error])
                    }
                }
            }

            const createSingleInput = (
                organization: Organization,
                name = faker.random.word(),
                lowValue = faker.datatype.number({ min: 0, max: 5 }),
                highValue = faker.datatype.number({ min: 5, max: 10 }),
                lowValueUnit = faker.random.arrayElement(
                    Object.values(AgeRangeUnit)
                ),
                highValueUnit = faker.random.arrayElement(
                    Object.values(AgeRangeUnit)
                )
            ) => {
                return {
                    organizationId: organization.organization_id,
                    name,
                    lowValue,
                    highValue,
                    lowValueUnit,
                    highValueUnit,
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

            it("checks if an age range already exists in the DB with the given 'name' in the organization given in 'organizationId", async () => {
                const ageRangeInSameOrg = createAgeRange(org)
                ageRangeInSameOrg.id = uuid_v4()

                const inactiveAgeRangeInSameOrg = createAgeRange(org)
                inactiveAgeRangeInSameOrg.id = uuid_v4()
                inactiveAgeRangeInSameOrg.status = Status.INACTIVE

                const differentOrg = await createOrganization().save()
                const ageRangeInDifferentOrg = createAgeRange(differentOrg)

                const testCases: {
                    input: CreateAgeRangeInput
                    error?: APIError
                }[] = await Promise.all(
                    [ageRangeInSameOrg, inactiveAgeRangeInSameOrg].map(
                        async (s) => {
                            const organization = (await s.organization)!
                            return {
                                input: createSingleInput(organization, s.name!),
                                error: createExistentEntityAttributeAPIError(
                                    'AgeRange',
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
                        await ageRangeInDifferentOrg.organization!,
                        ageRangeInDifferentOrg.name!
                    ),
                })

                const entityMap = await buildEntityMap([
                    ageRangeInSameOrg,
                    inactiveAgeRangeInSameOrg,
                    ageRangeInDifferentOrg,
                ])

                runTestCases(testCases, entityMap)
            })

            it("checks if an age range already exists in the DB with the given ('lowValue', 'highValue', 'lowValueUnit', 'highValueUnit') in the organization given in 'organizationId'", async () => {
                const ageRangeInSameOrg = createAgeRange(org)
                ageRangeInSameOrg.id = uuid_v4()

                const inactiveAgeRangeInSameOrg = createAgeRange(org)
                inactiveAgeRangeInSameOrg.id = uuid_v4()
                inactiveAgeRangeInSameOrg.status = Status.INACTIVE

                const differentOrg = await createOrganization().save()
                const ageRangeInDifferentOrg = createAgeRange(differentOrg)

                const testCases: {
                    input: CreateAgeRangeInput
                    error?: APIError
                }[] = await Promise.all(
                    [ageRangeInSameOrg, inactiveAgeRangeInSameOrg].map(
                        async (s) => {
                            const organization = (await s.organization)!
                            return {
                                input: createSingleInput(
                                    organization,
                                    undefined,
                                    s.low_value,
                                    s.high_value,
                                    s.low_value_unit,
                                    s.high_value_unit
                                ),
                                error: createExistentEntityAttributeAPIError(
                                    'AgeRange',
                                    s.id,
                                    'lowValue, lowValueUnit, highValue, highValueUnit',
                                    `${s.low_value} ${s.low_value_unit}(s) - ${s.high_value} ${s.high_value_unit}(s)`,
                                    0
                                ),
                            }
                        }
                    )
                )

                testCases.push({
                    input: createSingleInput(
                        await ageRangeInDifferentOrg.organization!,
                        ageRangeInDifferentOrg.name!
                    ),
                })

                const entityMap = await buildEntityMap([
                    ageRangeInSameOrg,
                    inactiveAgeRangeInSameOrg,
                    ageRangeInDifferentOrg,
                ])

                runTestCases(testCases, entityMap)
            })
        })
    })
})
