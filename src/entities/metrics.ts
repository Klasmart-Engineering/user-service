import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    getManager,
    EntityManager,
    PrimaryColumn,
    Index,
} from 'typeorm'
import { 
    ApolloServerPlugin,
    GraphQLRequestContextDidResolveOperation
} from "apollo-server-plugin-base"

@Entity({name: "user_metrics_query_variables"})
export class QueryVariables {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @CreateDateColumn()
    public createdAt?: Date

    @Index()
    @Column({ nullable: false })
    public queryHash?: string

    @Column({ nullable: false, type: "json" })
    public variables?: string

    @Column({ nullable: true, type: "json" })
    public token?: string

    @Column({ nullable: true })
    public origin?: string
}

@Entity({name: "user_metrics_query_count"})
export class QueryCount {
    @PrimaryColumn()
    public queryHash!: string

    @PrimaryColumn()
    public origin!: string
    
    @Column({nullable: false})
    public query!: string

    @Column({nullable: false, default: 1})
    public count!: number
    
    @CreateDateColumn()
    public createdAt?: Date
    @UpdateDateColumn()
    public updatedAt?: Date
}

const ENABLE_QUERY_COUNT = Boolean(process.env.METRICS_QUERY_COUNT)
const ENABLE_QUERY_VARIABLES = Boolean(process.env.METRICS_QUERY_VARIABLES)

let manager: EntityManager
export const gqlMetricLogging: ApolloServerPlugin = {
    requestDidStart: (c) => {
        if(!manager) { manager = getManager() }
        return {
            didResolveOperation: (context) => {
                if(ENABLE_QUERY_COUNT) { incrementQueryCount(context) }
                if(ENABLE_QUERY_VARIABLES) { logVariables(context) }
            }
        }
    }
}

async function logVariables(context: GraphQLRequestContextDidResolveOperation<Record<string, unknown>>) {
    try {
        if(context.operationName === "IntrospectionQuery") {return}
        console.log(`'${context.operationName}'`)
        const log = new QueryVariables()
        log.queryHash = context.queryHash || ""
        log.origin = context.request.http?.headers.get("origin") || ""
        log.variables = JSON.stringify(context.request.variables)
        log.token = JSON.stringify(context.context?.token)

        await manager.insert(QueryVariables, log)
    } catch(e) {
        console.log(e)
    }
}

async function incrementQueryCount(context: GraphQLRequestContextDidResolveOperation<Record<string, unknown>>) {
    try {
        const counter = new QueryCount()
        counter.queryHash = context.queryHash || ""
        counter.origin = context.request.http?.headers.get("origin") || ""
        counter.query = context.request.query || ""
        counter.count = 1

        await manager.createQueryBuilder()
            .insert()
            .into(QueryCount)
            .values(counter)
            .onConflict(`("queryHash", "origin") DO UPDATE SET "count" = "user_metrics_query_count"."count" + 1`)
            .execute();
    } catch(e) {
        console.log(e)
    }
}