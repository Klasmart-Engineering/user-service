import { mapping } from 'cassandra-driver';
import { GraphQLResolveInfo } from 'graphql';
import { Like } from "./like"
import { DeferredUser } from './user';

export interface Organization {
    id: string
    name?: string
    address1?: string
    address2?: string
    phone?: string
    shortCode?: string
}

export interface OrganizationResolver {
    id: string
    name: Like<string>
    address1: Like<string>
    address2: Like<string>
    phone: Like<string>
    shortCode: Like<string>
}

export class DeferredOrganization implements OrganizationResolver {
    id: string;
    private mapper: mapping.Mapper
    private _fetch?: Promise<Organization|null>|Organization
    constructor(mapper: mapping.Mapper, id: string, values?:Organization) {
        this.mapper = mapper
        this.id = id
        this._fetch = values
    }
    public async name() {
        const result = await this.fetch()
        if(result) { return result.name }
    }
    public async address1() {
        const result = await this.fetch()
        if(result) { return result.address1 }
    }
    public async address2() {
        const result = await this.fetch()
        if(result) { return result.address2 }
    }
    public async phone() {
        const result = await this.fetch()
        if(result) { return result.phone }
    }
    public async shortCode() {
        const result = await this.fetch()
        if(result) { return result.shortCode }
    }
    public async users() {
        const memberships =  await this.mapper.forModel("organization_users").find({organization_id: this.id})
        return memberships.toArray().map((membership) => new DeferredUser(this.mapper, membership.user_id))
    }
    public async addUser({id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return false }
            const join_date = Date.now()
            await this.mapper.forModel("organization_users").insert({organization_id: this.id, join_date, user_id: id})
            return true
        } catch(e) {
            console.log(e)
        }
        return false
    }
    public async removeUser({id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            console.log(id, info, context)  
            if(info.operation.operation !== "mutation") { return false }
            await this.mapper.forModel("organization_users").remove({organization_id: this.id, user_id: id})
            return true
        } catch(e) {
            console.log(e)
        }
        return false
    }
    private async fetch() {
        if(this._fetch) {return this._fetch}
        this._fetch = new Promise<Organization|null>(async (resolve, reject) => {
            try {
                const results = await this.mapper.forModel("organization").find({id: this.id})
                resolve(results.first())
            } catch(e) {
                reject(e)
            }
        })
        return this._fetch
    }
}