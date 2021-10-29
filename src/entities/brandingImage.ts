import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm'
import { BrandingImageTag } from '../types/graphQL/branding'
import { Branding } from './branding'
import { CustomBaseEntity } from './customBaseEntity'

@Entity()
export class BrandingImage extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

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
