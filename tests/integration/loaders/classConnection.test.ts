import { expect } from 'chai'
import faker from 'faker'
import { getConnection } from 'typeorm'
import { academicTermForClasses } from '../../../src/loaders/classesConnection'
import { createAcademicTerm } from '../../factories/academicTerm.factory'
import { createClass } from '../../factories/class.factory'
import { createSchool } from '../../factories/school.factory'
import { TestConnection } from '../../utils/testConnection'

describe('classConnection loaders', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })
    context('academicTerm', () => {
        let classToAcadmicTermMapping: Map<string, string>

        beforeEach(async () => {
            const school = await createSchool().save()

            classToAcadmicTermMapping = new Map()

            const academicTerms = []
            for (let i = 0; i < 2; i++) {
                academicTerms.push(createAcademicTerm(school))
            }
            await connection.manager.save(academicTerms)

            const classes = []

            for (const academicTerm of academicTerms) {
                const class_ = createClass()
                class_.class_id = faker.datatype.uuid()
                class_.academicTerm = Promise.resolve(academicTerm)
                classes.push(class_)
                classToAcadmicTermMapping.set(class_.class_id, academicTerm.id)
            }

            await connection.manager.save(classes)
        })

        it('returns the correct academic terms', async () => {
            const classIds = Array.from(classToAcadmicTermMapping.keys())
            const foundAcademicTerms = await academicTermForClasses(classIds)
            expect(foundAcademicTerms).to.have.length(
                classToAcadmicTermMapping.size
            )
            for (const [index, academicTerm] of foundAcademicTerms.entries()) {
                expect(academicTerm!.id).to.eq(
                    classToAcadmicTermMapping.get(classIds[index])
                )
            }
        })

        it('makes only one query', async () => {
            connection.logger.reset()
            expect(classToAcadmicTermMapping.size).greaterThan(1)
            await academicTermForClasses(
                Array.from(classToAcadmicTermMapping.keys())
            )
            expect(connection.logger.count).to.eq(1)
        })
    })
})
