import {Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinColumn, JoinTable, OneToMany, ManyToOne, getManager, getRepository, BaseEntity} from "typeorm";
import { GraphQLResolveInfo } from 'graphql';
import { OrganizationMembership } from "./organizationMembership";
import { ProfileOrganizationMembership } from "./profileOrganizationMembership";
import { Permission } from "./permission";
import { Organization } from "./organization";
import { SchoolMembership } from "./schoolMembership";
import { ProfileSchoolMembership } from "./profileSchoolMembership";
import { Context } from '../main';
import { PermissionName } from '../permissions/permissionNames';

@Entity()
export class Role extends BaseEntity {

    @PrimaryGeneratedColumn("uuid")
    public role_id!: string

    @Column({nullable: true})
    public role_name?: string

    @ManyToOne(() => Organization, organization => organization.roles)
    public organization?: Promise<Organization>

    @ManyToMany(() => OrganizationMembership, membership => membership.roles)
    @JoinTable()
    public memberships?: Promise<OrganizationMembership[]>

    @ManyToMany(() => ProfileOrganizationMembership, membership => membership.roles)
    @JoinTable()
    public profileMemberships?: Promise<ProfileOrganizationMembership[]>

    @ManyToMany(() => SchoolMembership, membership => membership.roles)
    @JoinTable()
    public schoolMemberships?: Promise<SchoolMembership[]>

    @ManyToMany(() => ProfileSchoolMembership, membership => membership.roles)
    @JoinTable()
    public profileSchoolMemberships?: Promise<ProfileSchoolMembership[]>

    @OneToMany(() => Permission, permission => permission.role)
    @JoinColumn()
    public permissions?: Promise<Permission[]>

    public async set({role_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization

            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_groups_30330
            )

            if(typeof role_name === "string") { this.role_name = role_name }

            await this.save()

            return this
        } catch(e) {
            console.error(e)
        }
    }

    public async permission({permission_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization

            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.view_role_permissions_30112
            )

            const permission = await getRepository(Permission).findOneOrFail({role_id: this.role_id, permission_name, })
            return permission
        } catch(e) {
            console.error(e)
        }
    }
    public async grant({permission_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization

            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_role_permissions_30332
            )

            const permission = await getRepository(Permission).save({role_id: this.role_id, permission_name, allow: true})
            return permission
        } catch(e) {
            console.error(e)
        }
    }
    public async revoke({permission_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization

            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_role_permissions_30332
            )

            await (Permission).delete({role_id: this.role_id, permission_name})
            return true
        } catch(e) {
            console.error(e)
        }
        return false
    }
    public async deny({permission_name}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization

            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.edit_role_permissions_30332
            )

            const permission = await getRepository(Permission).save({role_id: this.role_id, permission_name, allow: false})
            return permission
        } catch(e) {
            console.error(e)
        }
    }

    public async delete_role({}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const organization = await this.organization as Organization

            if(info.operation.operation !== "mutation" || !organization) { return null }

            const permisionContext = { organization_id: organization.organization_id }
            await context.permissions.rejectIfNotAllowed(
              permisionContext,
              PermissionName.delete_groups_30440
            )

            await this.remove()
            return true
        } catch(e) {
            console.error(e)
        }
        return false
    }

}
