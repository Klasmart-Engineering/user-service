import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { DataSource } from 'typeorm'
import { AddTimestampColumns1630420895212 } from '../../migrations/1630420895212-AddTimestampColumns'
import { CustomBaseEntity } from '../../src/entities/customBaseEntity'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { Status } from '../../src/entities/status'
import { createAgeRange } from '../factories/ageRange.factory'
import { createBranding } from '../factories/branding.factory'
import { createBrandingImage } from '../factories/brandingImage.factory'
import { createCategory } from '../factories/category.factory'
import { createClass } from '../factories/class.factory'
import { createGrade } from '../factories/grade.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createOrganizationOwnership } from '../factories/organizationOwnership.factory'
import { createPermission } from '../factories/permission.factory'
import { createProgram } from '../factories/program.factory'
import { createRole } from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createSubcategory } from '../factories/subcategory.factory'
import { createSubject } from '../factories/subject.factory'
import { createUser } from '../factories/user.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'

chai.should()
use(chaiAsPromised)

describe('AddTimestampColumns1630420895212 migration', () => {
    let baseDataSource: DataSource
    let migrationsDataSource: DataSource
    let entities: CustomBaseEntity[]
    let orgMemb: OrganizationMembership
    let schoolMemb: SchoolMembership

    before(async () => {
        baseDataSource = await createTestConnection()
    })
    after(async () => {
        await baseDataSource?.close()
    })
    afterEach(async () => {
        const pendingMigrations = await baseDataSource.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsDataSource?.close()
    })
    beforeEach(async () => {
        migrationsDataSource = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        await migrationsDataSource.runMigrations()

        const org = await createOrganization().save()
        const user = await createUser().save()
        const school = await createSchool(org).save()
        orgMemb = await createOrganizationMembership({
            user,
            organization: org,
        }).save()
        schoolMemb = await createSchoolMembership({ user, school }).save()

        entities = [
            createAgeRange(org),
            createBranding(org),
            createBrandingImage(),
            createCategory(org),
            createClass([], org),
            createGrade(org),
            org,
            orgMemb,
            createOrganizationOwnership({ user, organization: org }),
            createPermission(),
            createProgram(org),
            createRole(),
            createSchool(org),
            schoolMemb,
            createSubcategory(org),
            createSubject(org),
            user,
        ]
        for (const entity of entities) {
            await entity.save()
        }
    })
    it('manages the created_at column', async () => {
        for (const entity of entities) {
            expect(entity.created_at).to.exist
            expect(entity.created_at.valueOf()).to.be.greaterThan(0)
        }
    })
    it('manages updated_at columns', async () => {
        for (const entity of entities) {
            await entity.save()
            await new Promise((resolve) => setTimeout(resolve, 2))
            await entity.inactivate(baseDataSource.manager)
            expect(entity.updated_at.valueOf()).to.be.greaterThan(
                entity.created_at.valueOf()
            )
        }
    })
    it('manages deleted_at columns', async () => {
        // filter out membership objects as their inactivate() method functions differently (status_updated_at)
        entities = entities.filter((obj) => {
            obj != orgMemb || obj != schoolMemb
        })
        for (const entity of entities) {
            await entity.inactivate(baseDataSource.manager)
            expect(entity.deleted_at?.valueOf()).to.be.greaterThan(
                entity.created_at.valueOf()
            )
        }
    })
    it('manages soft deletes via status', async () => {
        for (const entity of entities) {
            expect(entity.status).to.eq(Status.ACTIVE)
            await entity.inactivate(baseDataSource.manager)
            expect(entity.status).to.eq(Status.INACTIVE)
        }
    })

    it('is benign if run twice', async () => {
        const migration = migrationsDataSource.migrations.find(
            (m) => m.name === AddTimestampColumns1630420895212.name
        )
        const runner = baseDataSource.createQueryRunner()
        // promise will be rejected if migration fails
        return migration!.up(runner).should.be.fulfilled
    })
})
