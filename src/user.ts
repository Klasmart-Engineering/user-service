import { mapping } from 'cassandra-driver';
import { GraphQLResolveInfo } from 'graphql';
import { Like } from "./like"
import { DeferredOrganization } from './organization';

export type User = { id: string } & UserFields
export interface UserFields {
    name?: string
    email?: string
    avatar?: string
}


interface UserResolver {
    id: string
    name: Like<string>
    email: Like<string>
    avatar: Like<string>
}

export class DeferredUser implements UserResolver {
    public id: string
    private _fetch?: Promise<User|null>|User
    private mapper: mapping.Mapper

    constructor(mapper: mapping.Mapper, id: string, values?:User) {
        this.mapper = mapper
        this.id = id
        this._fetch = values
    }
    public async name() {
        const result = await this.fetch()
        if(result) {return result.name}
    }
    public async email() {
        const result = await this.fetch()
        if(result) {return result.email}
    }
    public async avatar() {
        const result = await this.fetch()
        if(result) {return result.avatar}
    }

    public async organizations() {
        const memberships =  await this.mapper.forModel("organization_users").find({user_id: this.id})
        return memberships.toArray().map((membership) => new DeferredOrganization(this.mapper, membership.organization_id))
    }

    public async joinOrganization(parent: any, {id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return false }
            const join_date = Date.now()
            await this.mapper.forModel("organization_users").insert({organization_id: id, join_date, user_id: this.id})
            return true
        } catch(e) {
            console.log(e)
        }
        return false
    }
    public async leaveOrganization(parent: any, {id}: any, context: any, info: GraphQLResolveInfo) {
        try {    
            if(info.operation.operation !== "mutation") { return false }
            await this.mapper.forModel("organization_users").remove({organization_id: id, user_id: this.id})
            return true
        } catch(e) {
            console.log(e)
        }
        return false
    }

    private async fetch() {
        if(this._fetch) {return this._fetch}
        this._fetch = new Promise<User|null>(async (resolve, reject) => {
            try {
                const results = await this.mapper.forModel("user").find({id: this.id})
                resolve(results.first())
            } catch(e) {
                reject(e)
            }
        })
        return this._fetch
    }
}