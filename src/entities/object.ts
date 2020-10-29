import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index, JoinColumn, PrimaryColumn } from "typeorm"
import { User } from "./user"
import { Role } from "./role"
import { Organization } from "./organization"


enum AccessLevel {
    None,
    Read,
    Write,
    Full,
}

@Entity()
export class ACLObject {    
    @PrimaryGeneratedColumn("uuid")
    public object_id!: string

    @Column()
    @Index()
    public external_id?: string

    @Column()
    public default_access_level?: AccessLevel

    @CreateDateColumn()
    public created_timestamp?: Date
    
    @UpdateDateColumn()
    public updated_timestamp?: Date

    @ManyToOne(() => User)
    public owner?: Promise<User>

    @OneToMany(() => UserAccess, access => access.object)
    @JoinColumn({name: "object_id", referencedColumnName: "object_id"})
    public user_access?: Promise<UserAccess[]>
    
    @OneToMany(() => RoleAccess, access => access.object)
    @JoinColumn({name: "object_id", referencedColumnName: "object_id"})
    public role_access?: Promise<RoleAccess[]>
    
    @OneToMany(() => RoleAccess, access => access.object)
    @JoinColumn({name: "object_id", referencedColumnName: "object_id"})
    public organization_access?: Promise<OrganizationAccess[]>

}

export abstract class Access {
    @PrimaryColumn()
    public object_id!: string

    @ManyToOne(() => User)
    public object?: Promise<ACLObject>

    @Column()
    public access_level?: AccessLevel

    @CreateDateColumn()
    public created_timestamp?: Date
    
    @UpdateDateColumn()
    public updated_timestamp?: Date
}

@Entity()
export class UserAccess extends Access {
    @PrimaryColumn()
    public user_id!: string

    @ManyToOne(() => User)
    public user?: Promise<User>
}

@Entity()
export class RoleAccess extends Access {
    @PrimaryColumn()
    public role_id!: string

    @ManyToOne(() => Role)
    public role?: Promise<Role>
}

@Entity()
export class OrganizationAccess extends Access {
    @PrimaryColumn()
    public organization_id!: string

    @ManyToOne(() => User)
    public organization?: Promise<Organization>
}