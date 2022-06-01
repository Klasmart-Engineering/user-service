import supertest from 'supertest'
import { Grade } from '../../src/entities/grade'
import GradesInitializer from '../../src/initializers/grades'
import { getAPIKeyAuth, generateToken } from '../utils/testConfig'
import { expect } from 'chai'
import { GRADE_NODE } from '../utils/operations/modelOps'
import { print } from 'graphql'
import { User } from '../../src/entities/user'
import { makeRequest } from './utils'
import { DELETE_GRADES } from '../utils/operations/gradeOps'
import { userToPayload } from '../utils/operations/userOps'
import { createOrganization } from '../factories/organization.factory'
import { createGrade } from '../factories/grade.factory'
import { createUser } from '../factories/user.factory'
import { UserPermissions } from '../../src/permissions/userPermissions'

const url = 'http://localhost:8080'
const request = supertest(url)

describe('acceptance.grade', () => {
    let grades: Grade[]

    beforeEach(async () => {
        await GradesInitializer.run()
        grades = await Grade.find()
    })

    context('gradeNode', () => {
        context('when requested grade exists', () => {
            it('should respond succesfully', async () => {
                const grade = await Grade.findOneOrFail({
                    where: { name: 'PreK-1', system: true },
                })

                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAPIKeyAuth(),
                    })
                    .send({
                        query: print(GRADE_NODE),
                        variables: {
                            id: grade.id,
                        },
                    })

                const gradeNode = response.body.data.gradeNode

                expect(response.status).to.eq(200)
                expect(gradeNode.id).to.equal(grade.id)
                expect(gradeNode.name).to.equal(grade.name)
                expect(gradeNode.status).to.equal(grade.status)
                expect(gradeNode.system).to.equal(grade.system)

                const fromGrade = await grade.progress_from_grade

                expect(gradeNode.fromGrade.id).to.equal(fromGrade?.id)
                expect(gradeNode.fromGrade.name).to.equal(fromGrade?.name)
                expect(gradeNode.fromGrade.status).to.equal(fromGrade?.status)
                expect(gradeNode.fromGrade.system).to.equal(fromGrade?.system)

                const toGrade = await grade.progress_to_grade

                expect(gradeNode.toGrade.id).to.equal(toGrade?.id)
                expect(gradeNode.toGrade.name).to.equal(toGrade?.name)
                expect(gradeNode.toGrade.status).to.equal(toGrade?.status)
                expect(gradeNode.toGrade.system).to.equal(toGrade?.system)
            })
        })

        context('when requested grade does not exists', () => {
            it('should respond with errors', async () => {
                const gradeId = '00000000-0000-0000-0000-000000000000'
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAPIKeyAuth(),
                    })
                    .send({
                        query: print(GRADE_NODE),
                        variables: {
                            id: gradeId,
                        },
                    })

                const errors = response.body.errors
                const gradeNode = response.body.data.gradeNode

                expect(response.status).to.eq(200)
                expect(errors).to.exist
                expect(gradeNode).to.be.null
            })
        })
    })

    context('deleteGrades', () => {
        let adminUser: User
        let gradeToDelete: Grade

        const makeDeleteGradesMutation = async (input: any, caller: User) => {
            return await makeRequest(
                request,
                print(DELETE_GRADES),
                { input },
                generateToken(userToPayload(caller))
            )
        }

        beforeEach(async () => {
            const org = await createOrganization().save()
            gradeToDelete = await createGrade(org).save()
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
        })

        context('when data is requested in a correct way', () => {
            it('should pass gql schema validation', async () => {
                const input = [{ id: gradeToDelete.id }]
                const response = await makeDeleteGradesMutation(
                    input,
                    adminUser
                )

                const {
                    grades: deletedGrades,
                } = response.body.data.deleteGrades
                expect(response.status).to.eq(200)
                expect(deletedGrades).to.have.lengthOf(input.length)
                expect(response.body.errors).to.be.undefined
            })
        })

        it('has mandatory id field', async () => {
            const response = await makeDeleteGradesMutation([{}], adminUser)
            const { data } = response.body
            expect(response.status).to.eq(400)
            expect(data).to.be.undefined
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "id" of required type "ID!" was not provided.'
            )
        })
    })
})
