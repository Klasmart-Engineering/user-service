import {Entity, PrimaryGeneratedColumn, Column, OneToMany, getRepository, BaseEntity, ManyToOne, ManyToMany, getManager, JoinColumn, JoinTable, OneToOne, EntityManager} from "typeorm";
import { GraphQLResolveInfo } from 'graphql';
import { ProfileOrganizationMembership } from "./profileOrganizationMembership";
import { Organization } from "./organization";
import { Class } from "./class";
import { ProfileSchoolMembership } from "./profileSchoolMembership";
import { v5 } from "uuid";
import { createHash } from "crypto"
import { Permission } from "./permission";
import { Role } from "./role";
import { schoolAdminRole } from "../permissions/schoolAdmin";
import { organizationAdminRole } from "../permissions/organizationAdmin";
import { parentRole } from "../permissions/parent";
import { studentRole } from "../permissions/student";
import { teacherRole } from "../permissions/teacher";
import { School } from "./school";
import { User } from "./user";

@Entity()
export class UserProfile extends BaseEntity {

    @PrimaryGeneratedColumn("uuid")
    public user_profile_id!: string

    @Column({nullable: true})
    public user_profile_name?: string

    @ManyToOne(() => User, user => user.user_id)
    public user_profile_user_id?: Promise<User>

    @OneToMany(() => ProfileOrganizationMembership, membership => membership.user_profile)
    @JoinColumn({name: "organization_id", referencedColumnName: "organization_id"})
    public memberships?: Promise<ProfileOrganizationMembership[]>

    public async membership({organization_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(ProfileOrganizationMembership).findOneOrFail({where: {user_id: this.user_profile_id, organization_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @OneToMany(() => ProfileSchoolMembership, profileSchoolMembership => profileSchoolMembership.user_profile)
    @JoinColumn({name: "school_id", referencedColumnName: "school_id"})
    public school_memberships?: Promise<ProfileSchoolMembership[]>

    public async school_membership({school_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(ProfileSchoolMembership).findOneOrFail({where: {user_id: this.user_profile_id, school_id}})
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
            return await getRepository(ProfileOrganizationMembership)
                .createQueryBuilder()
                .innerJoin("OrganizationMembership.roles","Role")
                .innerJoin("Role.permissions","Permission")
                .groupBy("OrganizationMembership.organization_id, Permission.permission_name, OrganizationMembership.user_id")
                .where("OrganizationMembership.user_profile_id = :user_profile_id", this)
                .andWhere("Permission.permission_name = :permission_name", {permission_name})
                .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                .getMany()
        } catch(e) {
            console.error(e)
        }
    }

    public async schoolsWithPermission({permission_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            return await getRepository(ProfileSchoolMembership)
                .createQueryBuilder()
                .innerJoin("SchoolMembership.roles","Role")
                .innerJoin("Role.permissions","Permission")
                .groupBy("SchoolMembership.school_id, Permission.permission_name, SchoolMembership.user_profile_id")
                .where("SchoolMembership.user_profile_id = :user_profile_id", this)
                .andWhere("Permission.permission_name = :permission_name", {permission_name})
                .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                .getMany()
        } catch(e) {
            console.error(e)
        }
    }

    public async set({
        user_profile_user_id,
    }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            if(typeof user_profile_user_id === "string")   { this.user_profile_id = user_profile_user_id }
        
            await this.save()
            return this
        } catch(e) {
            console.error(e)
        }
    }
    public async createOrganization({organization_name, address1, address2, phone, shortCode}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const my_organization = await this.my_organization
            if(my_organization) { throw new Error("Only one organization per user") }

            const organization = new Organization()
            await getManager().transaction(async (manager) => {
                organization.organization_name = organization_name
                organization.address1 = address1
                organization.address2 = address2
                organization.phone = phone
                organization.shortCode = shortCode
            //    organization.owner = Promise.resolve(this)
            //    organization.primary_contact = Promise.resolve(this)
                await manager.save(organization)
                
                const roles = await organization._createDefaultRoles(manager)
                const adminRoles = roles.get("Organization Admin")
                
                const membership = new ProfileOrganizationMembership()
                membership.user_profile = Promise.resolve(this)
                membership.user_profile_id = this.user_profile_id
                membership.organization = Promise.resolve(organization)
                membership.organization_id = organization.organization_id
                if(adminRoles) { membership.roles = Promise.resolve(adminRoles) }
                organization.profileMemberships = Promise.resolve([membership])
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
            const membership = new ProfileOrganizationMembership()
            membership.organization_id = organization_id
            membership.organization = Promise.resolve(organization)
            membership.user_profile_id = this.user_profile_id
            membership.user_profile = Promise.resolve(this)
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
            const membership = new ProfileSchoolMembership()
            membership.school_id = school_id
            membership.school = Promise.resolve(school)
            membership.user_profile_id = this.user_profile_id
            membership.user_profile = Promise.resolve(this)
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