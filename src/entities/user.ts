import {Entity, PrimaryGeneratedColumn, Column, OneToMany, getRepository, BaseEntity, ManyToMany, getManager, JoinColumn, JoinTable, OneToOne, EntityManager, Not, CreateDateColumn} from "typeorm";
import { GraphQLResolveInfo } from 'graphql';
import { Length, IsOptional, IsEmail, IsIn, IsDateString, validate } from 'class-validator'
import { OrganizationMembership } from "./organizationMembership";
import { Organization, OrganizationInput } from "./organization";
import { Class } from "./class";
import { SchoolMembership } from "./schoolMembership";
import { v5 } from "uuid";
import { createHash } from "crypto"
import { School } from "./school";
import { AWSS3 } from "../entities/s3";
import { ApolloServerFileUploads } from "./types";
import { UniqueOnDatabase } from '../decorators/unique';
import { ErrorHelpers, BasicValidationError } from '../entities/helpers'
import { EntityId } from './organization'
import { DefaultAvatarKeys } from './const'

export interface UserInput {
    user_id?: string
    given_name: string
    family_name: string
    suffix_name: string
    email: string
    default_avatar?: string
    avatar?: ApolloServerFileUploads.File
    birth_year_month: Date
}

@Entity()
export class User extends BaseEntity {
    private _errors: null | undefined | BasicValidationError[]

    @PrimaryGeneratedColumn("uuid")
    public user_id!: string

    public user_name = () => `${this.given_name} ${this.family_name}`

    @Column({nullable: true})
    @Length(3, 15)
    public given_name?: string

    @Column({nullable: true})
    @Length(3, 15)
    public family_name?: string

    @Column({nullable: true})
    @IsOptional()
    @Length(0, 8)
    public suffix_name?: string

    @Column({nullable: true})
    @IsEmail()
    @Length(1, 50)
    @UniqueOnDatabase(User, (self: EntityId) => (self.user_id ? { user_id: Not(self.user_id as string) } : {}))
    public email?: string

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

    public async school_membership({school_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(SchoolMembership).findOneOrFail({where: {user_id: this.user_id, school_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @ManyToMany(() => Class, class_ => class_.teachers)
    @JoinTable()
    public classesTeaching?: Promise<Class[]>
    
    @ManyToMany(() => Class, class_ => class_.students)
    @JoinTable()
    public classesStudying?: Promise<Class[]>

    @OneToOne(() => Organization, organization => organization.owner)
    @JoinColumn()
    public my_organization?: Promise<Organization>

    public async organizationsWithPermission({permission_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            return await getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin("OrganizationMembership.roles","Role")
                .innerJoin("Role.permissions","Permission")
                .groupBy("OrganizationMembership.organization_id, Permission.permission_name, OrganizationMembership.user_id")
                .where("OrganizationMembership.user_id = :user_id", {user_id: this.user_id})
                .andWhere("Permission.permission_name = :permission_name", {permission_name})
                .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                .getMany()
        } catch(e) {
            console.error(e)
        }
    }

    public async schoolsWithPermission({permission_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            return await getRepository(SchoolMembership)
                .createQueryBuilder()
                .innerJoin("SchoolMembership.roles","Role")
                .innerJoin("Role.permissions","Permission")
                .groupBy("SchoolMembership.school_id, Permission.permission_name, SchoolMembership.user_id")
                .where("SchoolMembership.user_id = :user_id", {user_id: this.user_id})
                .andWhere("Permission.permission_name = :permission_name", {permission_name})
                .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                .getMany()
        } catch(e) {
            console.error(e)
        }
    }

    
    public async set({
        given_name, 
        family_name, 
        suffix_name, 
        email, 
        default_avatar, 
        avatar, 
        birth_year_month
    }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            if(typeof given_name === "string")          { this.given_name = given_name }
            if(typeof family_name === "string")         { this.family_name = family_name }
            if(typeof suffix_name === "string")         { this.suffix_name = suffix_name }
            if(typeof email === "string")               { this.email = email?.trim().toLowerCase() }
            if(typeof default_avatar === "string")      { this.default_avatar = default_avatar }
            if(typeof birth_year_month !== "undefined") { this.birth_year_month = birth_year_month }
            this.birth_year_month = birth_year_month ?? this.birth_year_month?.toISOString()

            if(!await this.isValid()) { return this }

            if(default_avatar) {
                this.avatarKey = default_avatar
            } else if(undefined !== avatar && null !== avatar && typeof avatar === 'object'){
                const s3 = AWSS3.getInstance({ 
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                    destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                    region: process.env.AWS_DEFAULT_REGION as string,
                })
                const upload = await s3.singleFileUpload({file: avatar as ApolloServerFileUploads.File, path: `users/${this.user_id}`, type: 'image'})
                this.avatarKey = upload.key
            }

            await this.save()

            return this
        } catch(e) {
            console.error(e)
        }
    }
    public async createOrganization({
        organization_name, 
        address1, 
        address2, 
        email, 
        phone, 
        shortCode, 
        color, 
        logo}: OrganizationInput, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const my_organization = await this.my_organization
            if(my_organization) { throw new Error("Only one organization per user") }

            const organization = new Organization()
            await getManager().transaction(async (manager) => {
                organization.organization_name = organization_name
                organization.address1 = address1
                organization.address2 = address2
                organization.email = email?.trim().toLowerCase()
                organization.phone = phone
                organization.shortCode = shortCode
                organization.color = color
                organization.owner = Promise.resolve(this)
                organization.primary_contact = Promise.resolve(this)

                if(!await organization.isValid()) {
                    return organization
                }

                if(undefined !== logo && null !== logo && typeof logo === 'object') {
                    const s3 = AWSS3.getInstance({ 
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                        destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                        region: process.env.AWS_DEFAULT_REGION as string,
                    })
                    const upload = await s3.singleFileUpload({file: logo as ApolloServerFileUploads.File, path: organization.organization_id, type: 'image'})
                
                    organization.logoKey = upload.key
                }
                await manager.save(organization)
                
                const roles = await organization._createDefaultRoles(manager)
                const adminRoles = roles.get("Organization Admin")
                
                const membership = new OrganizationMembership()
                membership.user = Promise.resolve(this)
                membership.user_id = this.user_id
                membership.organization = Promise.resolve(organization)
                membership.organization_id = organization.organization_id
                if(adminRoles) { membership.roles = Promise.resolve(adminRoles) }
                organization.memberships = Promise.resolve([membership])
                await manager.save(membership)
            })
    
            return organization
        } catch(e) {
            console.error(e)
        }
    }

    public async addOrganization({ organization_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            const organization = await getRepository(Organization).findOneOrFail(organization_id)
            const membership = new OrganizationMembership()
            membership.organization_id = organization_id
            membership.organization = Promise.resolve(organization)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    public async addSchool({ school_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            const school = await getRepository(School).findOneOrFail(school_id)
            const membership = new SchoolMembership()
            membership.school_id = school_id
            membership.school = Promise.resolve(school)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }}

const accountNamespace = v5("kidsloop.net", v5.DNS)
export function accountUUID(email?: string) {
    const hash = createHash('sha256');
    if(email) { hash.update(email) }
    return v5(hash.digest(), accountNamespace)
}