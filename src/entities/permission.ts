import {
    BaseEntity,
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryColumn,
} from 'typeorm'
import {
    CursorObject,
    Paginatable,
    toCursorHash,
} from '../utils/paginated.interface'
import { Role } from './role'

@Entity()
export class Permission
    extends BaseEntity
    implements Paginatable<Permission, string> {
    @PrimaryColumn({ name: 'permission_id' })
    public permission_name!: string

    // This is done to do a renaming without breaking the frontend. Will be
    // updated once both coloumns are backfiled
    @Column({ name: 'permission_name', nullable: true })
    public permission_id?: string

    @ManyToMany(() => Role, (role) => role.permissions)
    @JoinTable()
    public roles?: Promise<Role[]>

    @Column({ nullable: false })
    public allow!: boolean

    @Column({ nullable: true })
    public permission_category?: string

    @Column({ nullable: true })
    public permission_group?: string

    @Column({ nullable: true })
    public permission_level?: string

    @Column({ nullable: true })
    public permission_description?: string

    public compareKey(key: string): number {
        return key > this.permission_name
            ? 1
            : key < this.permission_name
            ? -1
            : 0
    }

    public compare(other: Permission): number {
        return other.permission_name > this.permission_name
            ? 1
            : other.permission_name < this.permission_name
            ? -1
            : 0
    }

    public generateCursor(total?: number, timestamp?: number): string {
        return toCursorHash(
            new CursorObject(this.permission_name, total, timestamp)
        )
    }
}
