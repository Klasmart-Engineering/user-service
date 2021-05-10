import { getWhereClauseFromFilter, IEntityFilter, filterHasProperty } from "../../../../src/utils/pagination/filtering";
import { Connection, createQueryBuilder } from "typeorm";
import { createTestConnection } from "../../../utils/testConnection";
import { expect } from "chai";

describe("getWhereClauseFromFilter", () => {

    let connection: Connection;
    before(async () => {
        connection = await createTestConnection();
    });
    after(async () => {
        await connection?.close();
    });

    it("doesn't filter if an empty filter config is provided", () => {
        const filter: IEntityFilter = {};

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));

        expect(scope.getSql().indexOf("WHERE")).to.equal(-1)
    });

    it("works on a single field", () => {
        const filter: IEntityFilter = {
            email: {
                operator: "eq",
                value: "joe@gmail.com"
            }
        };

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (email = $1)")
        expect(Object.keys(scope.getParameters()).length).to.equal(1);
    });
 
    it("works on multiple fields", () => {
        const filter: IEntityFilter = {
            email: {
                operator: "eq",
                value: "joe@gmail.com"
            },
            username: {
                operator: "eq",
                value: "joe",
            },
        };

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (email = $1 AND username = $2)");
        expect(Object.keys(scope.getParameters()).length).to.equal(2);
    });

    it("supports OR operations on different fields", () => {
        const filter: IEntityFilter = {
            OR: [
                {
                    email: {
                        operator: "eq",
                        value: "joe@gmail.com"
                    },
                },
                {
                    username: {
                        operator: "eq",
                        value: "joe",
                    },
                },
                {
                    gender: {
                        operator: "eq",
                        value: "female",
                    },
                },
            ],
        };

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (((email = $1) OR (username = $2) OR (gender = $3)))");
        expect(Object.keys(scope.getParameters()).length).to.equal(3);
    });

    it("supports OR operations on the same field", () => {
        const filter: IEntityFilter = {
            OR: [
                {
                    email: {
                        operator: "eq",
                        value: "joe@gmail.com"
                    },
                },
                {
                    email: {
                        operator: "eq",
                        value: "billy@gmail.com"
                    },
                },
                {
                    email: {
                        operator: "eq",
                        value: "sandy@gmail.com"
                    },
                },
            ],
        };

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (((email = $1) OR (email = $2) OR (email = $3)))");
        expect(Object.keys(scope.getParameters()).length).to.equal(3);
    });

    it("handles both fields + logical operators", () => {
        const filter: IEntityFilter = {
            email: {
                operator: "eq",
                value: "joe@gmail.com"
            },
            OR: [
                {
                    username: {
                        operator: "eq",
                        value: "joe",
                    }
                },
                {
                    gender: {
                        operator: "eq",
                        value: "female",
                    }
                },
            ],
        };

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (email = $1 AND ((username = $2) OR (gender = $3)))");
        expect(Object.keys(scope.getParameters()).length).to.equal(3);
    });

    it("supports AND + OR combinations", () => {
        const filter: IEntityFilter = {
            AND: [
                {
                    OR: [
                        {
                            email: {
                                operator: "eq",
                                value: "billy@gmail.com"
                            },
                        },
                        {
                            username: {
                                operator: "eq",
                                value: "billy"
                            },
                        },
                    ],
                },
                {
                    OR: [
                        {
                            email: {
                                operator: "eq",
                                value: "joe@gmail.com"
                            },
                        },
                        {
                            username: {
                                operator: "eq",
                                value: "joe"
                            },
                        },
                    ],
                },
            ],
        };

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (((((email = $1) OR (username = $2))) AND (((email = $3) OR (username = $4)))))");
        expect(Object.keys(scope.getParameters()).length).to.equal(4);
    });

    it("handles empty arrays", () => {
        const filter: IEntityFilter = {
            OR: [],
        };
        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));

        expect(scope.getSql().indexOf("WHERE")).to.equal(-1);
    });
    it("applies an AND operation if a single item is passed to the logical operators array", () => {
        const filter: IEntityFilter = {
            OR: [
                {
                    email: {
                        operator: "eq",
                        value: "joe@gmail.com"
                    }
                },
            ],
        };

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (((email = $1)))");
    });

    it("produces the correct query when using the 'contains' operator", () => {
        const filter: IEntityFilter = {
            email: {
                operator: "contains",
                value: "gmail"
            }
        };
        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));

        expect(whereClause).to.equal("WHERE (email LIKE $1)")
        expect(Object.keys(scope.getParameters()).length).to.equal(1);
        expect(scope.getParameters()[Object.keys(scope.getParameters())[0]]).to.equal("%gmail%");
    });

    it("supports case insensitivity", () => {
        const filter: IEntityFilter = {
            email: {
                operator: "contains",
                value: "GMAIL",
                caseInsensitive: true,
            }
        };
        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));
        const whereClause = scope.getSql().slice(scope.getSql().indexOf("WHERE"));
        console.log(whereClause)

        expect(whereClause).to.equal("WHERE (lower(email) LIKE lower($1))")
    });
});


describe("filterRequiresJoin", () => {
    it("works for properties at the root", () => {
        expect(filterHasProperty("user_id", {user_id: {operator: "eq", value: "123"}})).be.equal(true);
        expect(filterHasProperty("username", {user_id: {operator: "eq", value: "123"}})).be.equal(false);
    });

    it("works for nested properties", () => {
        expect(filterHasProperty("user_id", {
            OR: [
                {user_id: {operator: "eq", value: "abc"}},
                {username: {operator: "eq", value: "123"}}
            ],
        })).to.equal(true);

        expect(filterHasProperty("age", {
            OR: [
                {user_id: {operator: "eq", value: "abc"}},
                {username: {operator: "eq", value: "123"}}
            ],
        })).to.equal(false);
    });
});