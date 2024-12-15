import { SQLQueryIR, parseTSQuery, TSQueryAST } from '@pgtyped-lite/parser';
import { processSQLQueryIR } from './preprocessor-sql.js';
import { processTSQueryAST } from './preprocessor-ts.js';

export interface ICursor<T> {
  read(rowCount: number): Promise<T>;
  close(): Promise<void>;
}

export interface IDatabaseConnection {
  query: (query: string, bindings: any[]) => Promise<{ rows: any[] }>;
  stream?: (query: string, bindings: any[]) => ICursor<any[]>;
}

/** Check for column modifier suffixes (exclamation and question marks). */
function isHintedColumn(columnName: string): boolean {
  const lastCharacter = columnName[columnName.length - 1];
  return lastCharacter === '!' || lastCharacter === '?';
}

function mapQueryResultRows(rows: any[]): any[] {
  for (const row of rows) {
    for (const columnName in row) {
      if (isHintedColumn(columnName)) {
        const newColumnNameWithoutSuffix = columnName.slice(0, -1);
        row[newColumnNameWithoutSuffix] = row[columnName];
        delete row[columnName];
      }
    }
  }
  return rows.map(snakeToCamel);
}

function snakeToCamel<T extends Record<string, unknown>>(
  obj: T,
  depth = 1,
): any {
  return !(obj instanceof Object) || depth === 0
    ? obj
    : Object.entries(obj).reduce((result, [key, val]) => {
        return {
          ...result,
          [toCamelCaseString(key)]: Array.isArray(val)
            ? val.map((e) => snakeToCamel(e, depth - 1))
            : isObject(val)
              ? snakeToCamel(val as Record<string, unknown>, depth - 1)
              : val,
        };
        // biome-ignore lint/suspicious/noExplicitAny: as intended
      }, {} as any);
}

function toCamelCaseString<T extends string>(str: T) {
  return str.replace(/_(\w)/g, (_, c) =>
    c ? c.toUpperCase() : '',
  );
}

function isObject(item: any): boolean {
  return (
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    Object.prototype.toString.call(item) === '[object Object]'
  );
}

/* Used for SQL-in-TS */
export class TaggedQuery<TTypePair extends { params: any; result: any }> {
  public run: (
    params: TTypePair['params'],
    dbConnection: IDatabaseConnection,
  ) => Promise<Array<TTypePair['result']>>;

  public stream: (
    params: TTypePair['params'],
    dbConnection: IDatabaseConnection,
  ) => ICursor<Array<TTypePair['result']>>;

  private readonly query: TSQueryAST;

  constructor(query: TSQueryAST) {
    this.query = query;
    this.run = async (params, connection) => {
      const { query: processedQuery, bindings } = processTSQueryAST(
        this.query,
        params as any,
      );
      const result = await connection.query(processedQuery, bindings);
      const parsedResult = mapQueryResultRows(result.rows);
      if (this.query.name.endsWith('First')) {
        return parsedResult[0];
      }
      return parsedResult;
    };
    this.stream = (params, connection) => {
      const { query: processedQuery, bindings } = processTSQueryAST(
        this.query,
        params as any,
      );
      if (connection.stream == null)
        throw new Error("Connection doesn't support streaming.");
      const cursor = connection.stream(processedQuery, bindings);
      return {
        async read(rowCount: number) {
          const rows = await cursor.read(rowCount);
          return mapQueryResultRows(rows);
        },
        async close() {
          await cursor.close();
        },
      };
    };
  }
}

interface ITypePair {
  params: any;
  result: any;
}

export const sql = <TTypePair extends ITypePair>(
  stringsArray: TemplateStringsArray,
) => {
  const { query } = parseTSQuery(stringsArray[0]);
  return new TaggedQuery<TTypePair>(query);
};

/* Used for pure SQL */
export class PreparedQuery<TParamType, TResultType> {
  public run: (
    params: TParamType,
    dbConnection: IDatabaseConnection,
  ) => Promise<Array<TResultType>>;

  public stream: (
    params: TParamType,
    dbConnection: IDatabaseConnection,
  ) => ICursor<Array<TResultType>>;

  private readonly queryIR: SQLQueryIR;

  constructor(queryIR: SQLQueryIR) {
    this.queryIR = queryIR;
    this.run = async (params, connection) => {
      const { query: processedQuery, bindings } = processSQLQueryIR(
        this.queryIR,
        params as any,
      );
      const result = await connection.query(processedQuery, bindings);
      const parsedResult = mapQueryResultRows(result.rows);
      return parsedResult;
    };
    this.stream = (params, connection) => {
      const { query: processedQuery, bindings } = processSQLQueryIR(
        this.queryIR,
        params as any,
      );
      if (connection.stream == null)
        throw new Error("Connection doesn't support streaming.");
      const cursor = connection.stream(processedQuery, bindings);
      return {
        async read(rowCount: number) {
          const rows = await cursor.read(rowCount);
          return mapQueryResultRows(rows);
        },
        async close() {
          await cursor.close();
        },
      };
    };
  }
}

/* Used for pure SQL */
export class PreparedQueryFirst<TParamType, TResultType> {
  public run: (
    params: TParamType,
    dbConnection: IDatabaseConnection,
  ) => Promise<TResultType>;
  private readonly queryIR: SQLQueryIR;

  constructor(queryIR: SQLQueryIR) {
    this.queryIR = queryIR;
    this.run = async (params, connection) => {
      const { query: processedQuery, bindings } = processSQLQueryIR(
        this.queryIR,
        params as any,
      );
      const result = await connection.query(processedQuery, bindings);
      const parsedResult = mapQueryResultRows(result.rows);
      return parsedResult[0];
    };
  }
}

export default sql;
