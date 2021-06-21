import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm'
import { Organization } from './organization'
import { BrandingImage } from './brandingImage'

@Unique(['organization'])
@Entity()
export class Branding extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @CreateDateColumn({
        type: 'timestamp',
        default: () => 'now()',
    })
    public created_at!: Date

    @UpdateDateColumn({
        type: 'timestamp',
        default: () => ' now()',
        onUpdate: 'now()',
    })
    public updated_at!: Date

    @OneToOne(() => Organization)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @Column({ nullable: true, name: 'primary_color' })
    public primaryColor?: string

    @OneToMany(() => BrandingImage, (image) => image.branding)
    public images?: BrandingImage[]
}
