import {
    BaseEntity,
    Check,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm'
import { AgeRangeUnit } from './ageRangeUnit'
import { Organization } from './organization'

@Entity()
@Check(`"low_value" >= 0 AND "low_value" <= 99`)
@Check(`"high_value" > 0 AND "high_value" <= 99`)
@Unique(['low_value', 'high_value', 'unit', 'organization'])
export class AgeRange extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false })
    public high_value!: number

    @Column({ nullable: false })
    public low_value!: number

    @Column({ type: 'enum', enum: AgeRangeUnit, nullable: false })
    public unit!: AgeRangeUnit

    @Column({ nullable: false, default: false })
    public system?: boolean

    @ManyToOne(() => Organization, (organization) => organization.ageRanges)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @Column({ type: 'timestamp', nullable: false, default: () => 'now()' })
    public created_at?: Date

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date
}
