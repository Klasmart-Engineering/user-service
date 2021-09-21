import {
    BaseEntity,
    Column,
    Entity,
    getManager,
    In,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    EntityManager,
} from 'typeorm'
import { Status } from './status'
import { Organization } from './organization'
import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { PermissionName } from '../permissions/permissionNames'
import { Subject } from './subject'
import { AgeRange } from './ageRange'
import { Grade } from './grade'
import { School } from './school'
import { Class } from './class'

@Entity()
export class Program extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @ManyToMany(() => Organization)
    @JoinTable()
    public sharedWith?: Promise<Organization[]>

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false, default: false })
    public system?: boolean

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @ManyToMany(() => AgeRange)
    @JoinTable()
    public age_ranges?: Promise<AgeRange[]>

    @ManyToMany(() => Grade)
    @JoinTable()
    public grades?: Promise<Grade[]>

    @ManyToMany(() => Subject)
    @JoinTable()
    public subjects?: Promise<Subject[]>

    @ManyToOne(() => Organization, (organization) => organization.programs)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @Column({ type: 'timestamp', nullable: false, default: () => 'now()' })
    public created_at!: Date

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    @ManyToMany(() => School, (school) => school.programs)
    public schools?: Promise<School>

    @ManyToMany(() => Class, (class_) => class_.programs)
    public classes?: Promise<Class>

    public async editAgeRanges(
        { age_range_ids }: { age_range_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_program_20331
        )

        const validAgeRanges: AgeRange[] = await this.getAgeRanges(
            age_range_ids
        )
        this.age_ranges = Promise.resolve(validAgeRanges)

        await this.save()

        return validAgeRanges
    }

    public async editGrades(
        { grade_ids }: { grade_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_program_20331
        )

        const validGrades: Grade[] = await this.getGrades(grade_ids)
        this.grades = Promise.resolve(validGrades)

        await this.save()

        return validGrades
    }

    public async editSubjects(
        { subject_ids }: { subject_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_program_20331
        )

        const validSubjects: Subject[] = await this.getSubjects(subject_ids)
        this.subjects = Promise.resolve(validSubjects)

        await this.save()

        return validSubjects
    }

    private async getAgeRanges(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await AgeRange.find({
            where: { id: In(ids) },
        })
    }

    private async getGrades(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Grade.find({
            where: { id: In(ids) },
        })
    }

    private async getSubjects(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Subject.find({
            where: { id: In(ids) },
        })
    }

    public async delete(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return false
        }

        if (this.system) {
            context.permissions.rejectIfNotAdmin()
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_program_20441
        )

        await getManager().transaction(async (manager) => {
            await this.inactivate(manager)
        })

        return true
    }

    public async shareHelper(
        organizationIds: string[],
        replaceExisting = false
    ) {
        const validRequestedOrganizations = new Map(
            (await Organization.getOrganizations(organizationIds)).map((o) => [
                o.organization_id,
                o,
            ])
        )

        // owner should never be null but this is not actually enforced in the db
        const owner = await this.organization!
        if (validRequestedOrganizations.has(owner.organization_id)) {
            throw Error('nope, cant share with yourself')
        }

        let previousSharedWith: Organization[]
        if (replaceExisting) {
            previousSharedWith = (await this.sharedWith) || []
        } else {
            previousSharedWith = []
        }
        const previousSharedWithIds = new Set(
            previousSharedWith.map((o) => o.organization_id)
        )
        const newSharedWith = previousSharedWith
        for (const org of organizationIds) {
            if (!validRequestedOrganizations.has(org)) {
                throw Error('not a valid org ID')
            }
            if (previousSharedWithIds.has(org)) {
                throw Error('nope, already shared')
            } else {
                newSharedWith.push(validRequestedOrganizations.get(org)!)
            }
        }

        if (newSharedWith.length > 50) {
            throw Error('shared with too many orgs')
        }
        this.sharedWith = Promise.resolve(newSharedWith)
        return organizationIds
    }

    public async share(
        { organizationIds }: { organizationIds: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        const permisionContext = {
            organization_id,
        }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.share_content_282
        )
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_program_20331
        )
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status == Status.INACTIVE
        ) {
            return null
        }
        const neworgs = await this.shareHelper(organizationIds)
        await this.save()
        return neworgs
    }

    public async unshare(
        { organizationIds }: { organizationIds: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        const permisionContext = {
            organization_id,
        }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.share_content_282
        )
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_program_20331
        )
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status == Status.INACTIVE
        ) {
            return null
        }
        const requestedSet = new Set(organizationIds)
        const previousSharedWith = (await this.sharedWith) || []
        const previousSharedWithMap = new Map(
            (await this.sharedWith)?.map((o) => [o.organization_id, o]) || []
        )
        const newSharedWith = []
        for (const org of organizationIds) {
            if (!previousSharedWithMap.has(org)) {
                throw Error('nope, not already shared')
            }
        }
        for (const org of previousSharedWith) {
            if (!requestedSet.has(org.organization_id)) {
                newSharedWith.push(org)
            }
        }
        this.sharedWith = Promise.resolve(newSharedWith)

        await this.save()

        return newSharedWith.map((o) => o.organization_id)
    }

    public async inactivate(manager: EntityManager) {
        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await manager.save(this)
    }
}
