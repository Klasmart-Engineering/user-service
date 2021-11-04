import {
    Column,
    Entity,
    getManager,
    JoinColumn,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm'

import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Status } from './status'
import { CustomBaseEntity } from './customBaseEntity'
import { Category } from './category'

@Entity()
export class Subcategory extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false, default: false })
    public system?: boolean

    @ManyToOne(() => Organization, (organization) => organization.ageRanges)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @ManyToMany(() => Category, (category) => category.subcategories)
    public categories?: Promise<Category[]>

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
}
