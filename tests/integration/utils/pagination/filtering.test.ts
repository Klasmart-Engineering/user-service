import chaiAsPromised from "chai-as-promised";
import { Connection, getRepository, SelectQueryBuilder } from "typeorm";
import { expect, use } from "chai";
import { createTestConnection } from "../../../utils/testConnection";
import { User } from "../../../../src/entities/user";
import { IEntityFilter, getWhereClauseFromFilter } from "../../../../src/utils/pagination/filtering";

use(chaiAsPromised);

// don't use faker, as we need this to be deterministic for these tests
function getUsers() {
    const userData = [
        {
            given_name: "John",
            family_name: "Smith",
            email: "john@gmail.com",
            username: "john",
            date_of_birth: "01-1993",
            gender: "male",  
            primary: true,
            deleted_at: new Date(2020, 0, 1),
        },
        {
            given_name: "Sally",
            family_name: "Smith",
            email: "sally@gmail.com",
            username: "sally",
            date_of_birth: "01-2000",
            gender: "female",  
            primary: false,
            deleted_at: new Date(2000, 0, 1),
        },
    ];

    const users: User[] = [];
    for (const u of userData) {
        const user = new User();
        user.given_name = u.given_name;
        user.family_name = u.family_name;
        user.email = u.email;
        user.username = u.username;
        user.date_of_birth = u.date_of_birth;
        user.gender = u.gender;
        user.primary = u.primary;
        user.deleted_at = u.deleted_at;
        users.push(user);
    }

    return users;
}

describe('filtering', ()=>{
    let connection: Connection;
    let scope: SelectQueryBuilder<any>;

    before(async () => {
        connection = await createTestConnection();
    });

    after(async () => {
        await connection?.close();
    });

    beforeEach(async () => {
        await connection.manager.save(getUsers())
        scope = getRepository(User).createQueryBuilder();
    });

    context("strings", () => {
        it("supports string.eq", async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: "eq",
                    value: "john@gmail.com"
                }
            };
            
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
            
            expect(data.length).to.equal(1);
        });
        
        it("supports string.neq", async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: "neq",
                    value: "john@gmail.com"
                }
            };
            
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
            
            expect(data.length).to.equal(1);
        });
        
        it("supports string.contains", async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: "contains",
                    value: "john"
                }
            };
            
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
            
            expect(data.length).to.equal(1);
        });
    });

    context("booleans", () => {
        it("supports boolean.eq", async () => {
            const filter: IEntityFilter = {
                primary: {
                    operator: "eq",
                    value: true,
                }
            };
            
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
            
            expect(data.length).to.equal(1);
        });
    });

    context("dates", () => {
        it("supports date.eq", async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: "eq",
                    value: "2000-01-01",
                }
            };
    
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
    
            expect(data.length).to.equal(1);
        });
        it("supports date.neq", async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: "neq",
                    value: "2000-01-01",
                }
            };
    
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
    
            expect(data.length).to.equal(1);
        });
        it("supports date.gt", async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: "gt",
                    value: "2000-01-01",
                }
            };
    
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
    
            expect(data.length).to.equal(1);
        });
        it("supports date.gte", async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: "gte",
                    value: "2000-01-01",
                }
            };
    
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
    
            expect(data.length).to.equal(2);
        });
        it("supports date.lt", async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: "lt",
                    value: "2020-01-01",
                }
            };
    
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
    
            expect(data.length).to.equal(1);
        });
        it("supports date.lte", async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: "lte",
                    value: "2020-01-01",
                }
            };
    
            scope.andWhere(getWhereClauseFromFilter(filter));
            const data = await scope.getMany();
    
            expect(data.length).to.equal(2);
        });
    });
});
