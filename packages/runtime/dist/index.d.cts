import { TSQueryAST, SQLQueryIR } from '@pgtyped-lite/parser';

type Scalar = string | number | null;
declare enum ParameterTransform {
    Scalar = 0,
    Spread = 1,
    Pick = 2,
    PickSpread = 3
}
interface ScalarParameter {
    name: string;
    type: ParameterTransform.Scalar;
    required: boolean;
    assignedIndex: number;
}
interface DictParameter {
    name: string;
    type: ParameterTransform.Pick;
    dict: {
        [key: string]: ScalarParameter;
    };
}
interface ScalarArrayParameter {
    name: string;
    type: ParameterTransform.Spread;
    required: boolean;
    assignedIndex: number | number[];
}
interface DictArrayParameter {
    name: string;
    type: ParameterTransform.PickSpread;
    dict: {
        [key: string]: ScalarParameter;
    };
}
type QueryParameter = ScalarParameter | ScalarArrayParameter | DictParameter | DictArrayParameter;
interface InterpolatedQuery {
    query: string;
    mapping: QueryParameter[];
    bindings: Scalar[];
}
interface NestedParameters {
    [subParamName: string]: Scalar;
}
interface QueryParameters {
    [paramName: string]: Scalar | NestedParameters | Scalar[] | NestedParameters[];
}

declare const processTSQueryAST: (query: TSQueryAST, parameters?: QueryParameters) => InterpolatedQuery;

declare const processSQLQueryIR: (queryIR: SQLQueryIR, passedParams?: QueryParameters) => InterpolatedQuery;

interface ICursor<T> {
    read(rowCount: number): Promise<T>;
    close(): Promise<void>;
}
interface IDatabaseConnection {
    query: (query: string, bindings: any[]) => Promise<{
        rows: any[];
    }>;
    stream?: (query: string, bindings: any[]) => ICursor<any[]>;
}
declare class TaggedQuery<TTypePair extends {
    params: any;
    result: any;
}> {
    run: (params: TTypePair['params'], dbConnection: IDatabaseConnection) => Promise<Array<TTypePair['result']>>;
    stream: (params: TTypePair['params'], dbConnection: IDatabaseConnection) => ICursor<Array<TTypePair['result']>>;
    private readonly query;
    constructor(query: TSQueryAST);
}
interface ITypePair {
    params: any;
    result: any;
}
declare const sql: <TTypePair extends ITypePair>(stringsArray: TemplateStringsArray) => TaggedQuery<TTypePair>;
declare class PreparedQuery<TParamType, TResultType> {
    run: (params: TParamType, dbConnection: IDatabaseConnection) => Promise<Array<TResultType>>;
    stream: (params: TParamType, dbConnection: IDatabaseConnection) => ICursor<Array<TResultType>>;
    private readonly queryIR;
    constructor(queryIR: SQLQueryIR);
}
declare class PreparedQueryFirst<TParamType, TResultType> {
    run: (params: TParamType, dbConnection: IDatabaseConnection) => Promise<TResultType>;
    private readonly queryIR;
    constructor(queryIR: SQLQueryIR);
}

export { type IDatabaseConnection, type InterpolatedQuery, ParameterTransform, PreparedQuery, PreparedQueryFirst, type QueryParameter, type QueryParameters, TaggedQuery, processSQLQueryIR, processTSQueryAST, sql };
