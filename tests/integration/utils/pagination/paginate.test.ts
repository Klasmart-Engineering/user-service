import chaiAsPromised from "chai-as-promised";
import { Connection, getRepository } from "typeorm";
import { expect, use } from "chai";

import { Model } from "../../../../src/model";
import { createServer } from "../../../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../../../utils/createTestClient";
import { createTestConnection } from "../../../utils/testConnection";
import { User } from "../../../../src/entities/user";
import { createUser } from "../../../factories/user.factory";
import { paginateData } from "../../../../src/utils/pagination/paginate";
import { convertDataToCursor } from '../../../utils/paginate'

use(chaiAsPromised);

describe('paginate', ()=>{
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let usersList: User [] = [];
    let scope: any;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });
    
    beforeEach(async () => {
        usersList = [];
        // create 10 users
        for (let i=0; i<10; i++) {
            usersList.push(createUser())
            await connection.manager.save(usersList)
        }
        scope = getRepository(User).createQueryBuilder();
        //sort users by userId
        usersList.sort((a, b) => (a.user_id > b.user_id) ? 1 : -1)
    })
    context('seek forward',  ()=>{
        const direction = 'FORWARD'
        it('should get the first few records according to pagesize', async()=>{
            let directionArgs = { count: 3 }
            const data = await paginateData(direction, directionArgs, scope, 'user_id')
            
            expect(data.totalCount).to.eql(10);
            expect(data.edges.length).to.equal(3);
            for(let i=0; i<3; i++) {
                expect(data.edges[i].node.user_id).to.equal(usersList[i].user_id)
            }
            expect(data.pageInfo.startCursor).to.equal(convertDataToCursor(usersList[0].user_id))
            expect(data.pageInfo.endCursor).to.equal(convertDataToCursor(usersList[2].user_id))
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.false
        })
        it('should get the next few records according to pagesize and startcursor', async()=>{
            let directionArgs = { count: 3, cursor:convertDataToCursor(usersList[3].user_id)}
            const data = await paginateData(direction, directionArgs, scope, 'user_id')
            
            expect(data.totalCount).to.eql(10);
            expect(data.edges.length).to.equal(3);
            for(let i=0; i<3; i++) {
                expect(data.edges[i].node.user_id).to.equal(usersList[4+i].user_id)
            }
            expect(data.pageInfo.startCursor).to.equal(convertDataToCursor(usersList[4].user_id))
            expect(data.pageInfo.endCursor).to.equal(convertDataToCursor(usersList[6].user_id))
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.true
        })
        it('should get the last few records less than pagesize and startcursor', async()=>{
            let directionArgs = { count: 3, cursor:convertDataToCursor(usersList[7].user_id)}
            const data = await paginateData(direction, directionArgs, scope, 'user_id')
            expect(data.totalCount).to.eql(10);
            expect(data.edges.length).to.equal(2);
            for(let i=0; i<2; i++) {
                expect(data.edges[i].node.user_id).to.equal(usersList[8+i].user_id)
            }
            expect(data.pageInfo.startCursor).to.equal(convertDataToCursor(usersList[8].user_id))
            expect(data.pageInfo.endCursor).to.equal(convertDataToCursor(usersList[9].user_id))
            expect(data.pageInfo.hasNextPage).to.be.false
            expect(data.pageInfo.hasPreviousPage).to.be.true
        })
    })
})