import { getConnection, In } from 'typeorm'
import { makeUserWithPermission } from '../factories/user.factory'
import { TestConnection } from '../utils/testConnection'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { Organization } from '../../src/entities/organization'
import { DeleteGrades } from '../../src/resolvers/grade'
import { DeleteGradeInput } from '../../src/types/graphQL/grade'
import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import chaiAsPromised from 'chai-as-promised'
import { createGrade, createGrades } from '../factories/grade.factory'
import { Grade } from '../../src/entities/grade'
import { createInitialData } from '../utils/createTestData'
import { buildPermissionError } from '../utils/errors'
import { mutate } from '../../src/utils/resolvers/commonStructure'
import { Status } from '../../src/entities/status'

use(deepEqualInAnyOrder)
use(chaiAsPromised)

describe('grade', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    const createGradesToUse = async (org: Organization) =>
        await Grade.save(createGrades(10, org))

    describe('DeleteGrades', () => {
        let ctx: { permissions: UserPermissions }
        let org: Organization
        let gradesToDelete: Grade[]
        let deleteGrades: DeleteGrades

        beforeEach(async () => {
            const data = await createInitialData([
                PermissionName.delete_grade_20443,
            ])
            org = data.organization
            ctx = data.context
            gradesToDelete = await createGradesToUse(org)
            deleteGrades = new DeleteGrades([], ctx.permissions)
        })

        const buildDefaultInput = (grades: Grade[]): DeleteGradeInput[] =>
            Array.from(grades, ({ id }) => {
                return { id }
            })

        context('complete mutation calls', () => {
            it('can delete a grade', async () => {
                const input = buildDefaultInput([gradesToDelete[0]])
                const { grades } = await mutate(
                    DeleteGrades,
                    { input },
                    ctx.permissions
                )

                expect(grades).to.have.lengthOf(1)
                expect(grades[0].id).to.eq(input[0].id)
                expect(grades[0].status).to.eq(Status.INACTIVE)

                const dbGrades = await Grade.findBy({ id: In([input[0].id]) })
                expect(dbGrades).to.have.lengthOf(1)
                expect(dbGrades[0].status).to.eq(Status.INACTIVE)
            })

            const getDbCallCount = async (input: DeleteGradeInput[]) => {
                connection.logger.reset()
                await mutate(DeleteGrades, { input }, ctx.permissions)
                return connection.logger.count
            }

            it('makes the same number of db connections regardless of input length', async () => {
                await getDbCallCount(buildDefaultInput([gradesToDelete[0]])) // warm up permissions cache)

                const singleGradeCount = await getDbCallCount(
                    buildDefaultInput([gradesToDelete[1]])
                )

                const twoGradeCount = await getDbCallCount(
                    buildDefaultInput(gradesToDelete.slice(2, 4))
                )

                expect(twoGradeCount).to.be.eq(singleGradeCount)
                expect(twoGradeCount).to.be.equal(2)
            })
        })

        context('authorize', () => {
            const callAuthorize = async (
                userCtx: { permissions: UserPermissions },
                grades: Grade[]
            ) => {
                const input = buildDefaultInput(grades)
                const mutation = new DeleteGrades(input, userCtx.permissions)
                const maps = await mutation.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            it('checks the correct permission', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.delete_grade_20443
                )

                const permittedGrade = await createGrade(permittedOrg).save()
                await expect(callAuthorize(userCtx, [permittedGrade])).to.be
                    .fulfilled
            })

            it('rejects when user is not authorized', async () => {
                const {
                    permittedOrg,
                    userCtx,
                    clientUser,
                } = await makeUserWithPermission(
                    PermissionName.create_grade_20223
                )

                const permittedGrade = await createGrade(permittedOrg).save()

                await expect(
                    callAuthorize(userCtx, [permittedGrade])
                ).to.be.rejectedWith(
                    buildPermissionError(
                        PermissionName.delete_grade_20443,
                        clientUser,
                        [permittedOrg]
                    )
                )
            })

            it('rejects to delete a system grade', async () => {
                const { permittedOrg, userCtx } = await makeUserWithPermission(
                    PermissionName.delete_grade_20443
                )
                const permittedGrade = await createGrade(permittedOrg).save()
                const systemGrade = await createGrade(
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
