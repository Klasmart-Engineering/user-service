import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, EntityManager } from 'typeorm'
import { AcademicTerm } from '../../../src/entities/academicTerm'
import { Class } from '../../../src/entities/class'
import { School } from '../../../src/entities/school'
import { createAcademicTerm } from '../../factories/academicTerm.factory'
import { createClasses } from '../../factories/class.factory'
import { createSchool } from '../../factories/school.factory'
import { truncateTables } from '../../utils/database'
import { createTestConnection } from '../../utils/testConnection'

use(chaiAsPromised)

describe('AcademicTerm', () => {
    let connection: Connection
    let manager: EntityManager

    let academicTerm: AcademicTerm

    before(async () => {
        connection = await createTestConnection()
        manager = connection.manager
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        const school = await createSchool().save()
        academicTerm = createAcademicTerm(school)
    })

    afterEach(async () => {
        await truncateTables(connection)
    })

    describe('.new', () => {
        it('requires name, start_date, end_date, school properties', async () => {
            const props = ['name', 'start_date', 'end_date', 'school']
            for (const p of props) {
                ;(academicTerm as any)[p] = undefined
                // eslint-disable-next-line no-await-in-loop
                await expect(manager.save(academicTerm)).to.be.rejected
            }
        })

        context('when all details are correct', () => {
            beforeEach(async () => {
                await academicTerm.save()
            })

            it('creates the academic term', async () => {
                const academicTermDB = await AcademicTerm.findOneByOrFail({
                    id: academicTerm.id,
                })

                expect(academicTermDB.id).to.eq(academicTerm.id)
                expect(academicTermDB.name).to.eq(academicTerm.name)
                expect(academicTermDB.start_date.valueOf()).to.eq(
                    academicTerm.start_date.valueOf()
                )
                expect(academicTermDB.end_date.valueOf()).to.eq(
                    academicTerm.end_date.valueOf()
                )
            })

            it('sets relations and readonly ID properties', async () => {
                const school = await School.save(createSchool())
                const classes = await Class.save(createClasses(2))

                academicTerm.school = Promise.resolve(school)
                academicTerm.classes = Promise.resolve(classes)
                await academicTerm.save()

                await school.reload()
                await Promise.all(classes.map((c) => c.reload()))

                const academicTermDB = await AcademicTerm.findOneByOrFail({
                    id: academicTerm.id,
                })
                const schoolDB = await academicTermDB.school
                const classesDB = await academicTermDB.classes

                expect(academicTermDB.school_id).to.eq(school.school_id)
                expect(schoolDB.school_id).to.eq(school.school_id)
                expect(classesDB?.map((c) => c.class_id)).to.have.same.members(
                    classes.map((c) => c.class_id)
                )

                expect(
                    (await school.academicTerms)?.map((a) => a.id)
                ).to.have.same.members([academicTerm.id])
                for (const c of classes) {
                    expect(c.academic_term_id).to.eq(academicTerm.id)
                    // eslint-disable-next-line no-await-in-loop
                    expect((await c.academicTerm)?.id).to.eq(academicTerm.id)
                }
            })
        })
    })
})
