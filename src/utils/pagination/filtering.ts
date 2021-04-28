import { Brackets } from "typeorm";
import { v4 as uuid_v4 } from 'uuid'

export interface IUserFilter {
    given_name?: IFilter;
    family_name?: IFilter;
    username?: IFilter;
    email?: IFilter;
    phone?: IFilter;
    date_of_birth?: IFilter;
    gender?: IFilter;
    avatar?: IFilter;
    status?: IFilter;
    deleted_at?: IFilter;
    primary?: IFilter;
    alternate_email?: IFilter;
    alternate_phone?: IFilter;

    OR?: IUserFilter[];
    AND?: IUserFilter[];
}

type FilteringOperator = "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains";

interface IFilter {
    operator: FilteringOperator;
    value: string | number | boolean;
}

export function getWhereClauseFromFilter(filter: IUserFilter): Brackets {
    return new Brackets(qb => {
        for (const key of Object.keys(filter)) {
            if (key === "OR" || key === "AND") {
                // process these recursively afterwards
                continue;
            }
            const keyTyped = key as keyof IUserFilter;
            const data = filter[keyTyped] as IFilter;
            
            const field = parseField(key);
            const sqlOperator = getSQLOperatorFromFilterOperator(data.operator);
            const value = parseValueForSQLOperator(sqlOperator, data.value);

            // parameter keys must be unique when using typeorm querybuilder
            const uniqueId = uuid_v4();
    
            qb.andWhere(`${field} ${sqlOperator} :${uniqueId}`, {[uniqueId]: value});
        };

        if (filter.OR) {
            qb.andWhere(logicalOperationFilter(filter.OR, "OR"));
        }
        if (filter.AND) {
            qb.andWhere(logicalOperationFilter(filter.AND, "AND"));
        }
    });
}

function logicalOperationFilter(filters: IUserFilter[], operator: "AND" | "OR") {
    return new Brackets(qb => {
        if (filters.length > 0) {
            qb.where(getWhereClauseFromFilter(filters[0]));
            for (let i=1; i<filters.length; i++) {
                if (operator === "AND") {
                    qb.andWhere(getWhereClauseFromFilter(filters[i]));
                } else {
                    qb.orWhere(getWhereClauseFromFilter(filters[i]));
                }
            }
        }
    });
}

function getSQLOperatorFromFilterOperator(op: FilteringOperator) {
    const operators: Record<FilteringOperator, string> = {
        eq: "=",
        neq:"!=",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<=",
        contains: "LIKE",
    }

    return operators[op];
}

function parseValueForSQLOperator(operator: string, value: unknown) {
    switch (operator) {
        case "LIKE": 
            return `%${value}%`;
        default:
            return value;
    }
}

function parseField(field: string) {
    switch (field) {
        case "primary": // "primary" is a reserved SQL keyword, so we need to wrap in quotes
            return `"primary"`;
        default:
            return field;
    }
}
