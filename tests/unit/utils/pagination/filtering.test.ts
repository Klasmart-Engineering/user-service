import { IUserFilter, getWhereClauseFromFilter } from "../../../../src/utils/pagination/filtering";
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
        const filter: IUserFilter = {};

        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));

        expect(scope.getSql().indexOf("WHERE")).to.equal(-1)
    });

    it("works on a single field", () => {
        const filter: IUserFilter = {
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
        const filter: IUserFilter = {
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
        const filter: IUserFilter = {
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
        const filter: IUserFilter = {
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
        const filter: IUserFilter = {
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
        const filter: IUserFilter = {
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
        const filter: IUserFilter = {
            OR: [],
        };
        const scope = createQueryBuilder("user");
        scope.andWhere(getWhereClauseFromFilter(filter));

        expect(scope.getSql().indexOf("WHERE")).to.equal(-1);
    });
    it("applies an AND operation if a single item is passed to the logical operators array", () => {
        const filter: IUserFilter = {
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
        const filter: IUserFilter = {
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
});
