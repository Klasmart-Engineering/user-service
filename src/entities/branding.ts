import {
    Column,
    Entity,
    JoinColumn,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm'
import { Organization } from './organization'
import { BrandingImage } from './brandingImage'
import { CustomBaseEntity } from './customBaseEntity'

@Unique(['organization'])
@Entity()
export class Branding extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @OneToOne(() => Organization)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @Column({ type: 'text', nullable: true, name: 'primary_color' })
    public primaryColor?: string | null

    @OneToMany(() => BrandingImage, (image) => image.branding)
    public images?: BrandingImage[]
}
