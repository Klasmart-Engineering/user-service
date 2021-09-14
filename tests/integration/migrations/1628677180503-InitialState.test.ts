import { Connection, QueryRunner } from 'typeorm'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../../utils/testConnection'
import { expect } from 'chai'
import { InitialState1628677180503 } from '../../../migrations/1628677180503-InitialState'
import { getDatabaseTables } from '../../utils/migrations'

const expectedTables: string[] = [
    'attendance',
    'grade',
    'organization',
    'role',
    'user',
    'school',
    'subcategory',
    'category',
    'subject',
    'program',
    'class',
    'category_subcategories_subcategory',
    'subject_categories_category',
    'organization_ownership',
    'branding',
    'branding_image',
    'age_range',
    'permission',
    'permission_roles_role',
    'role_memberships_organization_membership',
    'role_school_memberships_school_membership',
    'program_age_ranges_age_range',
    'program_grades_grade',
    'program_subjects_subject',
    'school_classes_class',
    'school_programs_program',
    'class_programs_program',
    'class_age_ranges_age_range',
    'class_grades_grade',
    'class_subjects_subject',
    'user_classes_teaching_class',
    'user_classes_studying_class',
    'organization_membership',
    'school_membership',
]

describe('InitialState1628677180503 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let queryRunner: QueryRunner
    before(async () => {
        baseConnection = await createTestConnection()
        queryRunner = baseConnection.createQueryRunner()
    })
    after(async () => {
        await baseConnection?.close()
    })
    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })
    it('initializes the full schema when pointed at an empty DB', async () => {
        // drop schema and connect with synchronize disabled
        migrationsConnection = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === InitialState1628677180503.name
        )
        expect(migration).to.exist

        await migration!.up(queryRunner)

        const tables = await getDatabaseTables(migrationsConnection)
        for (const table of expectedTables) {
            expect(tables).to.include(table)
        }
    })

    it('is benign when run against an existing database', async () => {
        // DON'T drop schema and connect with synchronize disabled
        migrationsConnection = await createMigrationsTestConnection(
            false,
            false,
            'migrations'
        )
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === InitialState1628677180503.name
        )
        expect(migration).to.exist

        await migration!.up(queryRunner)

        const tables = await getDatabaseTables(migrationsConnection)
        for (const table of expectedTables) {
            expect(tables).to.include(table)
        }
    })
})
