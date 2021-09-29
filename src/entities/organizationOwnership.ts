import { Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm'

import { Organization } from './organization'
import { User } from './user'
import { CustomBaseEntity } from './customBaseEntity'

@Entity()
export class OrganizationOwnership extends CustomBaseEntity {
    @PrimaryColumn()
    public user_id!: string

    @OneToOne(() => User, (user) => user.user_id)
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    public user!: Promise<User>

    @PrimaryColumn()
    public organization_id!: string

    @OneToOne(() => Organization, (org) => org.organization_id)
    @JoinColumn({
        name: 'organization_id',
        referencedColumnName: 'organization_id',
    })
    public organization!: Promise<Organization>
}
