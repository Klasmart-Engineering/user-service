import {
    BaseEntity,
    Column,
    Entity,
    getManager,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    EntityManager,
} from 'typeorm'

import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Category } from './category'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Subcategory } from './subcategory'
import { Status } from './status'
import { Class } from './class'
import { Program } from './program'

@Entity()
export class Subject extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false, default: false })
    public system?: boolean

    @ManyToOne(() => Organization, (organization) => organization.ageRanges)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @ManyToMany(() => Category, (category) => category.subjects)
    @JoinTable()
    public categories?: Promise<Category[]>

    @ManyToMany(() => Class, (_class) => _class.subjects)
    public classes?: Promise<Class[]>

    public async subcategories(
        args: Record<string, unknown>,
        context: Context,
        info: Record<string, unknown>
    ): Promise<Subcategory[]> {
        const organization_id = (await this.organization)?.organization_id
        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_subjects_20115
        )

        const dbSubcategories: Subcategory[] = []
        const categories = (await this.categories) || []

        for (const category of categories) {
            const categorySubcategories = (await category.subcategories) || []
            dbSubcategories.push(...categorySubcategories)
        }

        return dbSubcategories
    }

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @Column({ type: 'timestamp', nullable: false, default: () => 'now()' })
    public created_at!: Date

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    @ManyToMany(() => Program, (program) => program.subjects)
    public programs?: Promise<Program[]>

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
            PermissionName.delete_subjects_20447
        )

        await getManager().transaction(async (manager) => {
            await this.inactivate(manager)
        })

        return true
    }

    public async inactivate(manager: EntityManager) {
        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await manager.save(this)
    }
}
