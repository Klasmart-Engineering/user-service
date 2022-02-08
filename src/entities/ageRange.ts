import {
    Check,
    Column,
    Entity,
    getManager,
    JoinColumn,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm'
import { AgeRangeUnit } from './ageRangeUnit'
import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Status } from './status'
import { CustomBaseEntity } from './customBaseEntity'
import { Class } from './class'
import { Program } from './program'

@Entity()
@Check(`"low_value" >= 0 AND "low_value" <= 99`)
@Check(`"high_value" > 0 AND "high_value" <= 99`)
@Unique([
    'low_value',
    'high_value',
    'low_value_unit',
    'high_value_unit',
    'organization',
])
export class AgeRange extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false })
    public high_value!: number

    @Column({ nullable: false })
    public low_value!: number

    @Column({ type: 'enum', enum: AgeRangeUnit, nullable: false })
    public high_value_unit!: AgeRangeUnit

    @Column({ type: 'enum', enum: AgeRangeUnit, nullable: false })
    public low_value_unit!: AgeRangeUnit

    @Column({ nullable: false, default: false })
    public system!: boolean

    @ManyToOne(() => Organization, (organization) => organization.ageRanges)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @ManyToMany(() => Class, (cl) => cl.age_ranges)
    public classes?: Promise<Class[]>

    @ManyToMany(() => Program, (program) => program.age_ranges)
    public programs?: Promise<Program[]>

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
            PermissionName.delete_age_range_20442
        )

        await getManager().transaction(async (manager) => {
            await this.inactivate(manager)
        })

        return true
    }
}
