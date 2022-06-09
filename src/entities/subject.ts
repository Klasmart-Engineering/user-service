import {
    Column,
    Entity,
    getManager,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    RelationId,
} from 'typeorm'

import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Category } from './category'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Subcategory } from './subcategory'
import { Status } from './status'
import { Class } from './class'
import { CustomBaseEntity } from './customBaseEntity'
import { Program } from './program'

@Entity()
export class Subject extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false, default: false })
    public system?: boolean

    @ManyToOne(() => Organization, (organization) => organization.subjects)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @RelationId((subject: Subject) => subject.organization)
    public readonly organization_id?: string

    @ManyToMany(() => Category, (category) => category.subjects)
    @JoinTable()
    public categories?: Promise<Category[]>

    @ManyToMany(() => Class, (_class) => _class.subjects)
    public classes?: Promise<Class[]>

    @ManyToMany(() => Program, (program) => program.subjects)
    public programs?: Promise<Program[]>

    public async subcategories(
        args: Record<string, unknown>,
        context: Context,
        info: Record<string, unknown>
    ): Promise<Subcategory[]> {
        const organization_id = (await this.organization)?.organization_id
        const permissionContext = {
            organization_ids: organization_id ? [organization_id] : undefined,
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
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

    public async delete(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            this.status !== Status.ACTIVE
        ) {
            return false
        }

        if (this.system) {
            context.permissions.rejectIfNotAdmin()
        }

        const permissionContext = {
            organization_ids: organization_id ? [organization_id] : undefined,
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_subjects_20447
        )

        await getManager().transaction(async (manager) => {
            await this.inactivate(manager)
        })

        return true
    }
}
