import { Connection, QueryRunner } from 'typeorm'
import { createTestConnection } from '../utils/testConnection'
import { expect } from 'chai'
import { InitialState1628677180503 } from '../../migrations/1628677180503-InitialState'

export async function getDatabaseTables(queryRunner: QueryRunner) {
    const tables = (await queryRunner.query(`
        SELECT table_name
            FROM information_schema.tables
        WHERE table_schema='public'
            AND table_type='BASE TABLE';
    `)) as { table_name: string }[]

    return tables.map((table) => table.table_name)
}

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
    let migrationsConnection: Connection
    let queryRunner: QueryRunner
    beforeEach(async () => {
        migrationsConnection = await createTestConnection({ drop: true })
        queryRunner = migrationsConnection.createQueryRunner()
    })
    afterEach(async () => {
        await migrationsConnection.close()
    })
    it('initializes the full schema when pointed at an empty DB', async () => {
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === InitialState1628677180503.name
        )
        expect(migration).to.exist

        await migration!.up(queryRunner)

        const tables = await getDatabaseTables(queryRunner)
        for (const table of expectedTables) {
            expect(tables).to.include(table)
        }
    })

    it('is benign when run against an existing database', async () => {
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === InitialState1628677180503.name
        )
        await migration!.up(queryRunner)

        await migration!.up(queryRunner)

        const tables = await getDatabaseTables(queryRunner)
        for (const table of expectedTables) {
            expect(tables).to.include(table)
        }
    })
})
