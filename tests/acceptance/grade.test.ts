import supertest from 'supertest'
import { Grade } from '../../src/entities/grade'
import GradesInitializer from '../../src/initializers/grades'
import { getAdminAuthToken } from '../utils/testConfig'
import { expect } from 'chai'
import { GRADE_NODE } from '../utils/operations/modelOps'
import { print } from 'graphql'

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
                        Authorization: getAdminAuthToken(),
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
                        Authorization: getAdminAuthToken(),
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
})
