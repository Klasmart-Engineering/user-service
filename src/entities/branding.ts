import {
    BaseEntity,
    Column,
    Entity,
    JoinColumn,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
} from 'typeorm'
import { Organization } from './organization'
import { BrandingImage } from './brandingImage'

@Entity()
export class Branding extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @OneToOne(() => Organization, (organization) => organization.branding)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @Column({ nullable: true })
    public primaryColor?: string

    @OneToMany(() => BrandingImage, (image) => image.branding)
    public images?: BrandingImage[]
}
