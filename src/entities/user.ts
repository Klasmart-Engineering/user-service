import {Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, getRepository, BaseEntity, ManyToMany, getManager, JoinColumn, JoinTable, CreateDateColumn, Not} from "typeorm";
import { Length, IsEmail, IsOptional, IsDateString, IsIn, Matches, validate } from 'class-validator'
import { GraphQLResolveInfo } from 'graphql';
import { OrganizationMembership } from "./organizationMembership";
import { Role } from "./role";
import { Organization, OrganizationInput, OrganizationStatus } from "./organization";
import { Class } from "./class";
import { SchoolMembership } from "./schoolMembership";
import { ApolloServerFileUploads } from "./types"
import { AWSS3 } from "../entities/s3";
import { UniqueOnDatabase } from '../decorators/unique';
import { ErrorHelpers, BasicValidationError } from '../entities/helpers'
import { EntityId } from './organization'
import { DefaultAvatarKeys } from './const'

export const UserStatus = {
    "PENDING": "PENDING",
    "ACTIVE": "ACTIVE",
    "SUSPENDED": "SUSPENDED",
    "INACTIVE": "INACTIVE",
}

export interface UserInput {
    user_id?: string
    first_name: string
    last_name: string
    middle_name?: string
    suffix_name: string
    email: string
    is_child: boolean
    default_avatar?: string
    avatar?: ApolloServerFileUploads.File
    birth_year_month: Date
}

@Entity()
export class User extends BaseEntity {
    private _errors: null | undefined | BasicValidationError[]

    @PrimaryGeneratedColumn("uuid")
    public user_id!: string

    @Column({nullable: true})
    @Length(3, 15)
    public first_name?: string

    @Column({nullable: true})
    @IsOptional()
    @Length(3, 15)
    public middle_name?: string
    
    @Column({nullable: true})
    @Length(3, 15)
    public last_name?: string
    
    @Column({nullable: true})
    @IsOptional()
    @Length(0, 8)
    public suffix_name?: string

    @Column({nullable: false, unique: true})
    @IsEmail()
    @Length(1, 50)
    @UniqueOnDatabase(User, (self: EntityId) => (self.user_id ? { user_id: Not(self.user_id as string) } : {}))
    public email?: string

    @Column({nullable: false, default: false})
    public is_child?: boolean

    @IsOptional()
    @IsIn(DefaultAvatarKeys)
    public default_avatar?: string

    @Column({nullable: true})
    public avatarKey?: string

    public async avatar() {
        if(this.avatarKey) {
            const s3 = AWSS3.getInstance({ 
                accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                region: process.env.AWS_DEFAULT_REGION as string,
            })
            
            return s3.getSignedUrl(this.avatarKey as string)
        }
        return ''
    }

    @Column({nullable: true})
    @IsDateString()
    public birth_year_month?: Date

    @CreateDateColumn()
    public createdAt?: Date

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt?: Date

    // pass arguments for validation of UniqueOnDatabase  
    // constraint columns on updating the entity
    public __req__: EntityId | null = {}

    public async errors() {
        if(undefined !== this._errors) { return this._errors }

        const info: EntityId = {
            user_id: this.user_id
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

    @OneToMany(() => OrganizationMembership, membership => membership.user)
    @JoinColumn({name: "organization_id", referencedColumnName: "organization_id"})
    public memberships?: Promise<OrganizationMembership[]>
    public async membership({organization_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(OrganizationMembership).findOneOrFail({where: {user_id: this.user_id, organization_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @OneToMany(() => SchoolMembership, schoolMembership => schoolMembership.user)
    @JoinColumn({name: "school_id", referencedColumnName: "school_id"})
    public school_memberships?: Promise<SchoolMembership[]>

    @ManyToMany(() => Class, class_ => class_.teachers)
    @JoinTable()
    public classesTeaching?: Promise<Class[]>
    
    @ManyToMany(() => Class, class_ => class_.students)
    @JoinTable()
    public classesStudying?: Promise<Class[]>

    @OneToOne(() => Organization, organization => organization.owner)
    @JoinColumn()
    public my_organization?: Promise<Organization>

    public async createOrganization({organization_name, address1, address2, email, phone, shortCode, color, logo}: OrganizationInput, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const my_organization = await this.my_organization
            if(my_organization) { throw new Error("Only one organization per user") }
            
            const organization = new Organization()

            organization.organization_name = organization_name
            organization.address1 = address1
            organization.address2 = address2
            organization.email = email.trim().toLowerCase()
            organization.phone = phone
            organization.shortCode = shortCode
            organization.color = color
            organization.status = OrganizationStatus.ACTIVE
            organization.owner = Promise.resolve(this)
            organization.primary_contact = Promise.resolve(this)

            if(!await organization.isValid()) {
                return organization
            }

            await getManager().save(organization)

            const s3 = AWSS3.getInstance({ 
                accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                region: process.env.AWS_DEFAULT_REGION as string,
            })
            const upload = await s3.singleFileUpload({file: logo as ApolloServerFileUploads.File, path: organization.organization_id, type: 'image'})
        
            organization.logoKey = upload.key
            await getManager().save(organization)
    
            return organization
        } catch(e) {
            console.error(e)
        }
    }

    public async addOrganization({ organization_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const membership = new OrganizationMembership()
            membership.organization_id = organization_id
            membership.organization = getRepository(Organization).findOneOrFail(organization_id)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }
}
