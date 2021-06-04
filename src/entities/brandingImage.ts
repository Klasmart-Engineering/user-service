import {
    BaseEntity,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm'
import { brandingImageTag } from '../types/graphQL/brandingImageTag'
import { Branding } from './branding'

@Entity()
@Unique(['tag', 'branding'])
export class BrandingImage extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public tag?: brandingImageTag

    @Column({ nullable: false })
    public url?: string

    @ManyToOne(() => Branding, (branding) => branding.images)
    public branding?: Branding
}
