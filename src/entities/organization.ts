import { Column, PrimaryGeneratedColumn, Entity, OneToMany, getRepository, getManager, JoinColumn, ManyToOne, ManyToMany, JoinTable, OneToOne, CreateDateColumn, Not } from 'typeorm';
import { Length, IsEmail, IsHexColor, IsOptional, IsIn, IsUppercase, Matches, validate } from 'class-validator'
import { GraphQLResolveInfo } from 'graphql';
import { OrganizationMembership } from './organizationMembership';
import { Role } from './role';
import { User } from './user';
import { Class } from './class';
import { School } from './school';
import { ApolloServerFileUploads } from "./types"
import { AWSS3 } from "../entities/s3";
import { UniqueOnDatabase } from '../decorators/unique';
import { ErrorHelpers, BasicValidationError } from '../entities/helpers'

export const OrganizationStatus = {
    "ACTIVE": "ACTIVE",
    "INACTIVE": "INACTIVE",
}

export interface OrganizationInput {
    userId?: string
    organization_id?: string
    organization_name: string
    address1: string
    address2?: string
    email: string
    phone: string
    shortCode: string
    color: string
    logo?: ApolloServerFileUploads.File
}

export interface EntityId {
    organization_id?: string
    user_id?: string
}

@Entity()
export class Organization {
    private _errors: null | undefined | BasicValidationError[]

    @PrimaryGeneratedColumn("uuid")
    public readonly organization_id!: string;
    
    @Column({nullable: false})
    @Length(3, 30)
    public organization_name?: string
    
    @Column({nullable: false})
    @Length(3, 30)
    public address1?: string
    
    @Column({nullable: true})
    @IsOptional()
    @Length(3, 30)
    public address2?: string
    
    @Column({nullable: false, unique: true})
    @IsEmail()
    @Length(1, 50)
    @UniqueOnDatabase(Organization, (self: EntityId) => (self.organization_id ? { organization_id: Not(self.organization_id as string) } : {}))
    public email?: string

    @Column({nullable: false, unique: true})
    @Matches(/^[0-9]{10,15}$/)
    @UniqueOnDatabase(Organization, (self: EntityId) => (self.organization_id ? { organization_id: Not(self.organization_id as string) } : {}))
    public phone?: string
    
    @Column({nullable: false, unique: true})
    @IsUppercase()
    @Length(8,8)
    @UniqueOnDatabase(Organization, (self: EntityId) => (self.organization_id ? { organization_id: Not(self.organization_id as string) } : {}))
    public shortCode?: string

    // pass arguments for validation of UniqueOnDatabase  
    // constraint columns on updating the entity
    public __req__: EntityId | null = {}

    @Column({nullable: true})
    public logoKey?: string

    public async logo() {
        if(this.logoKey) {
            const s3 = AWSS3.getInstance({ 
                accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                region: process.env.AWS_DEFAULT_REGION as string,
            })
            
            return s3.getSignedUrl(this.logoKey as string)
        }
        return ''
    }

    @Column({nullable: true})
    @IsHexColor()
    public color?: string

    @Column({nullable: false})
    @IsIn([OrganizationStatus.ACTIVE, OrganizationStatus.INACTIVE])
    public status?: string

    @CreateDateColumn()
    public createdAt?: Date

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt?: Date

    public async errors() {
        if(undefined !== this._errors) { return this._errors }

        const info: EntityId = {
            organization_id: this.organization_id
        }
        this.__req__ = info
        
        this._errors = null
        const errs = await validate(this)
        if(errs.length > 0) {
            this._errors = ErrorHelpers.GetValidationError(errs)
        }
        return this._errors
    }

    public async isValid() {
        await this.errors()
        return (this._errors === null)
    }

    @OneToMany(() => OrganizationMembership, membership => membership.organization)
    @JoinColumn({name: "user_id", referencedColumnName: "user_id"})
    public memberships?: Promise<OrganizationMembership[]>

    public async membership({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(OrganizationMembership).findOneOrFail({where: {user_id, organization_id: this.organization_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @ManyToOne(() => User)
    @JoinColumn()
    public primary_contact?: Promise<User>
    
    @OneToMany(() => Role, role => role.organization)
    @JoinColumn()
    public roles?: Promise<Role[]>

    public async teachers() { }
    public async students() { }

    @OneToMany(() => School, school => school.organization)
    @JoinColumn()
    public schools?: Promise<School[]>

    @OneToMany(() => Class, class_ => class_.organization)
    @JoinColumn()
    public classes?: Promise<Class[]>

    public async setPrimaryContact({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            
            const user = await getRepository(User).findOneOrFail({user_id})
            this.primary_contact = Promise.resolve(user)
            await getManager().save(this)
            
            return user
        } catch(e) {
            console.error(e)
        }
    }

    public async addUser({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            const membership = new OrganizationMembership()
            membership.organization_id = this.organization_id
            membership.organization = Promise.resolve(this)
            membership.user_id = user_id
            membership.user = getRepository(User).findOneOrFail(user_id)

            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    public async createRole({role_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const manager = getManager()
            
            const role = new Role()
            role.role_name = role_name
            role.organization = Promise.resolve(this)
            await manager.save(role)
            return role
        } catch(e) {
            console.error(e)
        }
    }

    public async createClass({class_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const manager = getManager()
            
            const _class = new Class()
            _class.class_name = class_name
            _class.organization = Promise.resolve(this)
            await manager.save(_class)

            return _class
        } catch(e) {
            console.error(e)
        }
    }

    public async createSchool({school_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            
            const school = new School()
            school.school_name = school_name
            school.organization = Promise.resolve(this)
            await school.save()

            return school
        } catch(e) {
            console.error(e)
        }
    }
}
