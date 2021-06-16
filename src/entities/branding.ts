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
import { createHash } from 'crypto'
import { v5 } from 'uuid'

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

    @Column({ nullable: true })
    public primaryColor?: string

    @OneToMany(() => BrandingImage, (image) => image.branding)
    public images?: BrandingImage[]
}

const accountNamespace = v5('kidsloop.net', v5.DNS)
export function brandingUUID(organization_id?: string) {
    const hash = createHash('sha256')
    if (organization_id) {
        hash.update(organization_id)
    }
    return v5(hash.digest(), accountNamespace)
}
