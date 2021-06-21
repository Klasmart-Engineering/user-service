import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm'
import { BrandingImageTag } from '../types/graphQL/brandingImageTag'
import { Branding } from './branding'

@Entity()
export class BrandingImage extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @CreateDateColumn({
        type: 'timestamp',
        default: () => 'now()',
    })
    public created_at!: Date

    @UpdateDateColumn({
        type: 'timestamp',
        default: () => 'now()',
        onUpdate: 'now()',
    })
    public updated_at!: Date

    @Column({ nullable: false })
    public tag?: BrandingImageTag

    @Column({ nullable: false })
    public url?: string

    @ManyToOne(() => Branding, (branding) => branding.images, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'branding_id' })
    public branding?: Branding
}
