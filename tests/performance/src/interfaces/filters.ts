export interface Filter {
    [key:string]: {
        value: string;
        operator: string;
    }
}