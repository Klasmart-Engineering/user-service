import { getConnection } from 'typeorm'
import { makeUserWithPermission } from '../factories/user.factory'
import { TestConnection } from '../utils/testConnection'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { Organization } from '../../src/entities/organization'
import { AgeRange } from '../../src/entities/ageRange'
import { DeleteAgeRanges } from '../../src/resolvers/ageRange'
import { createAgeRange, createAgeRanges } from '../factories/ageRange.factory'
import { DeleteAgeRangeInput } from '../../src/types/graphQL/ageRange'
import { mutate } from '../../src/utils/resolvers/commonStructure'
import { Status } from '../../src/entities/status'
import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import chaiAsPromised from 'chai-as-promised'
import { buildPermissionError } from '../utils/errors'
import { createInitialData } from '../utils/createTestData'

use(deepEqualInAnyOrder)
use(chaiAsPromised)

describe('ageRange', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    const createAgeRangesToUse = async (org: Organization) =>
        await AgeRange.save(createAgeRanges(10, org))

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
})
