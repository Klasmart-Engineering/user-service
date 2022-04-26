import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, QueryRunner } from 'typeorm'
import { CreateAcademicTermEntity1648053310507 } from '../../migrations/1648053310507-CreateAcademicTermEntity'
import { School } from '../../src/entities/school'
import { createClass } from '../factories/class.factory'
import { createSchool } from '../factories/school.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'
import { getDatabaseTables } from './1628677180503-InitialState.test'

use(chaiAsPromised)

describe('CreateAcademicTermEntity1648053310507 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let runner: QueryRunner

    before(async () => {
        baseConnection = await createTestConnection()
        runner = baseConnection.createQueryRunner()
    })

    after(async () => {
        await baseConnection?.close()
    })

    beforeEach(async () => {
        migrationsConnection = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        await migrationsConnection.runMigrations()
    })
    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })

    function insert(
        name?: string,
        start_date?: Date,
        end_date?: Date,
        school_id?: string
    ) {
        return runner.manager.insert('academic_term', {
            name,
            start_date,
            end_date,
            school: school_id,
        })
    }

    context('migration is run once', () => {
        it('creates the academic term table', async () => {
            const tables = await getDatabaseTables(migrationsConnection)
            expect(tables).to.include('academic_term')
        })

        it('adds a class <> academic term relation', async () => {
            await createClass().save()
            const result = await runner.query('select * from class')
            expect(result[0].academic_term_id).to.be.null
        })

        context('column definitions', () => {
            let school: School
            beforeEach(async () => {
                school = await createSchool().save()
            })
            it('allows inserts of entities with all required properties defined', async () => {
                await expect(
                    insert('test', new Date(), new Date(), school.school_id)
                ).to.be.fulfilled
            })
            it('makes name non-nullable', async () => {
                await expect(
                    insert(undefined, new Date(), new Date(), school.school_id)
                ).to.be.rejectedWith(
                    'null value in column "name" violates not-null constraint'
                )
            })
            it('makes start_date non-nullable', async () => {
                await expect(
                    insert('AT', undefined, new Date(), school.school_id)
                ).to.be.rejectedWith(
                    'null value in column "start_date" violates not-null constraint'
                )
            })
            it('makes end_date non-nullable', async () => {
                await expect(
                    insert('AT', new Date(), undefined, school.school_id)
                ).to.be.rejectedWith(
                    'null value in column "end_date" violates not-null constraint'
                )
            })
            it('makes school non-nullable', async () => {
                await expect(
                    insert('AT', new Date(), new Date(), undefined)
                ).to.be.rejectedWith(
                    'null value in column "school_id" violates not-null constraint'
                )
            })
        })
    })

    context('migration is run twice', () => {
        it('is benign', async () => {
            const migration = migrationsConnection.migrations.find(
                (m) => m.name === CreateAcademicTermEntity1648053310507.name
            )!
            await expect(migration!.up(runner)).to.be.fulfilled
        })
    })
})
