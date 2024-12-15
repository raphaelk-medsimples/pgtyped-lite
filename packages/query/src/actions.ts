import crypto from 'crypto';
import debugBase from 'debug';
import type { InterpolatedQuery, QueryParameter } from '@pgtyped-lite/runtime';

import { ExecProtocolOptions, ExecProtocolResult, PGlite, QueryOptions } from "@electric-sql/pglite";

import { serialize as serializeProtocol } from './pglite-pg-protocol/serializer.js';
import type { ParameterDescriptionMessage, RowDescriptionMessage } from "./pglite-pg-protocol/messages.js";

import { DatabaseTypeKind, isEnum, MappableType } from './type.js';

const debug = debugBase('pg-query:actions');

export const generateHash = (
  username: string,
  password: string,
  salt: Buffer,
) => {
  const hash = (str: string) =>
    crypto.createHash('md5').update(str).digest('hex');
  const shadow = hash(password + username);
  const result = crypto.createHash('md5');
  result.update(shadow);
  result.update(salt);
  return 'md5' + result.digest('hex');
};

export interface IQueryTypes {
  paramMetadata: {
    mapping: QueryParameter[];
    params: MappableType[];
  };
  returnTypes: Array<{
    returnName: string;
    columnName: string;
    type: MappableType;
    nullable?: boolean;
    comment?: string;
  }>;
}

export interface IParseError {
  errorCode: string;
  hint?: string;
  message: string;
  position?: string;
}

interface TypeField {
  name: string;
  tableOID: number;
  columnAttrNumber: number;
  typeOID: number;
  typeSize: number;
  typeModifier: number;
  formatCode: number;
}

type TypeData =
  | {
      fields: Array<TypeField>;
      params: Array<{ oid: number }>;
    }
  | IParseError;

/**
 * Returns the raw query type data as returned by the Describe message
 * @param query query string, can only contain proper Postgres numeric placeholders
 * @param query name, should be unique per query body
 * @param queue
 */
export async function getTypeData(
  query: string,
  db: PGlite,
): Promise<TypeData> {
  const dbExt = pgliteExtension(db);
  const { params, fields } = await dbExt.describeQuery(query);

  return { params, fields };
}

enum TypeCategory {
  ARRAY = 'A',
  BOOLEAN = 'B',
  COMPOSITE = 'C',
  DATE_TIME = 'D',
  ENUM = 'E',
  GEOMETRIC = 'G',
  NETWORK_ADDRESS = 'I',
  NUMERIC = 'N',
  PSEUDO = 'P',
  STRING = 'S',
  TIMESPAN = 'T',
  USERDEFINED = 'U',
  BITSTRING = 'V',
  UNKNOWN = 'X',
}

interface TypeRow {
  oid: string;
  typeName: string;
  typeKind: string;
  enumLabel: string;
  typeCategory?: TypeCategory;
  elementTypeOid?: string;
}

// Aggregate rows from database types catalog into MappableTypes
export function reduceTypeRows(
  typeRows: TypeRow[],
): Record<string, MappableType> {
  const enumTypes = typeRows
    .filter((r) => r.typeKind === DatabaseTypeKind.Enum)
    .reduce((typeMap, { oid, typeName, enumLabel }) => {
      const typ = typeMap[oid] ?? typeName;

      // We should get one row per enum value
      return {
        ...typeMap,
        [oid]: {
          name: typeName,
          // Merge enum values
          enumValues: [...(isEnum(typ) ? typ.enumValues : []), enumLabel],
        },
      };
    }, {} as Record<string, MappableType>);
  return typeRows.reduce(
    (typeMap, { oid, typeName, typeCategory, elementTypeOid }) => {
      // Attempt to merge any partially defined types
      const typ = typeMap[oid] ?? typeName;

      if (oid in enumTypes) {
        return { ...typeMap, [oid]: enumTypes[oid] };
      }

      if (
        typeCategory === TypeCategory.ARRAY &&
        elementTypeOid &&
        elementTypeOid in enumTypes
      ) {
        return {
          ...typeMap,
          [oid]: {
            name: typeName,
            elementType: enumTypes[elementTypeOid],
          },
        };
      }

      return { ...typeMap, [oid]: typ };
    },
    {} as Record<string, MappableType>,
  );
}

// TODO: self-host
async function runTypesCatalogQuery(
  typeOIDs: number[],
  db: PGlite,
): Promise<TypeRow[]> {
  let rows: any[];
  if (typeOIDs.length > 0) {
    const concatenatedTypeOids = typeOIDs.join(',');
    rows = await db.query(`
      SELECT pt.oid, pt.typname, pt.typtype, pe.enumlabel, pt.typelem, pt.typcategory
      FROM pg_type pt
      LEFT JOIN pg_enum pe ON pt.oid = pe.enumtypid
      WHERE pt.oid IN (${concatenatedTypeOids})
      OR pt.oid IN (SELECT typelem FROM pg_type ptn WHERE ptn.oid IN (${concatenatedTypeOids}));
      `,
      [],
      { rowMode: 'array' }
    ).then(({ rows }: { rows: any}) => { 
      debug('runTypesCatalogQuery', { rows }); 
      return rows; 
    });
  } else {
    rows = [];
  }
  return rows.map(
    ([oid, typeName, typeKind, enumLabel, elementTypeOid, typeCategory]) => ({
      oid,
      typeName,
      typeKind,
      enumLabel,
      elementTypeOid,
      typeCategory,
    }),
  );
}

interface ColumnComment {
  tableOID: number;
  columnAttrNumber: number;
  comment: string;
}

async function getComments(
  fields: TypeField[],
  db: PGlite,
): Promise<ColumnComment[]> {
  const columnFields = fields.filter((f) => f.columnAttrNumber > 0);
  if (columnFields.length === 0) {
    return [];
  }

  const matchers = columnFields.map(
    (f) => `(objoid=${f.tableOID} and objsubid=${f.columnAttrNumber})`,
  );
  const selection = matchers.join(' or ');

  const descriptionRows = await db.query(
    `SELECT
      objoid, objsubid, description
     FROM pg_description WHERE ${selection};`,
     [],
     { rowMode: 'array' }
  ).then(({ rows }: { rows: any}) => { 
    debug('getComments', { rows }); 
    return rows; 
  });

  return descriptionRows.map((row: any) => ({
    tableOID: Number(row[0]),
    columnAttrNumber: Number(row[1]),
    comment: row[2],
  }));
}

export async function getTypes(
  queryData: InterpolatedQuery,
  db: PGlite,
): Promise<IQueryTypes | IParseError> {
  const typeData = await getTypeData(queryData.query, db);
  if ('errorCode' in typeData) {
    return typeData;
  }

  const { params, fields } = typeData;

  const paramTypeOIDs = params.map((p) => p.oid);
  const returnTypesOIDs = fields.map((f) => f.typeOID);
  const usedTypesOIDs = paramTypeOIDs.concat(returnTypesOIDs);
  const typeRows = await runTypesCatalogQuery(usedTypesOIDs, db);
  const commentRows = await getComments(fields, db);
  const typeMap = reduceTypeRows(typeRows);

  const attrMatcher = ({
    tableOID,
    columnAttrNumber,
  }: {
    tableOID: number;
    columnAttrNumber: number;
  }) => `(attrelid = ${tableOID} and attnum = ${columnAttrNumber})`;

  const attrSelection =
    fields.length > 0 ? fields.map(attrMatcher).join(' or ') : false;

  const attributeRows = await db.query(
    `SELECT
      (attrelid || ':' || attnum) AS attid, attname, attnotnull
     FROM pg_attribute WHERE ${attrSelection};`,
     [],
     { rowMode: 'array' }
  ).then(({ rows }: { rows: any}) => { 
    debug('getTypes', { rows }); 
    return Array.from(rows) as any[]; 
  });

  const attrMap: {
    [attid: string]: {
      columnName: string;
      nullable: boolean;
    };
  } = attributeRows.reduce(
    (acc: any, [attid, attname, attnotnull]: any) => ({
      ...acc,
      [attid]: {
        columnName: attname,
        nullable: attnotnull !== 't',
      },
    }),
    {},
  );

  const getAttid = (col: Pick<TypeField, 'tableOID' | 'columnAttrNumber'>) =>
    `${col.tableOID}:${col.columnAttrNumber}`;

  const commentMap: { [attid: string]: string | undefined } = {};
  for (const c of commentRows) {
    commentMap[`${c.tableOID}:${c.columnAttrNumber}`] = c.comment;
  }

  const returnTypes = fields.map((f) => ({
    ...attrMap[getAttid(f)],
    ...(commentMap[getAttid(f)] ? { comment: commentMap[getAttid(f)] } : {}),
    returnName: f.name,
    type: typeMap[f.typeOID],
  }));

  const paramMetadata = {
    params: params.map(({ oid }) => typeMap[oid]),
    mapping: queryData.mapping,
  };

  return { paramMetadata, returnTypes };
}

function pgliteExtension(db: PGlite) {
  return {
    async execProtocolNoSync(
      message: Uint8Array,
      options: ExecProtocolOptions = {},
    ): Promise<ExecProtocolResult> {
      return await db.execProtocol(message, { ...options, syncToFs: false })
    },

    async describeQuery(
      query: string,
      options?: QueryOptions,
    ) {
      try {
        await this.execProtocolNoSync(
          serializeProtocol.parse({ text: query, types: options?.paramTypes }),
          options,
        )
  
        const describeResults = await this.execProtocolNoSync(
          serializeProtocol.describe({ type: 'S' }),
          options,
        )
        const paramDescription = describeResults.messages.find(
          (msg): msg is ParameterDescriptionMessage =>
            msg.name === 'parameterDescription',
        )
        const resultDescription = describeResults.messages.find(
          (msg): msg is RowDescriptionMessage => msg.name === 'rowDescription',
        )
  
        const params =
          paramDescription?.dataTypeIDs.map((dataTypeID) => ({
            oid: dataTypeID,
          })) ?? []
  
        const fields = resultDescription?.fields.map((field) => ({
          name: field.name,
          tableOID: field.tableID,
          columnAttrNumber: field.columnID,
          typeOID: field.dataTypeID,
          typeSize: field.dataTypeSize,
          typeModifier: field.dataTypeModifier,
          formatCode: field.format,
        })) ?? []
  
        return { params, fields }
      } finally {
        await this.execProtocolNoSync(serializeProtocol.sync(), options)
      }
    }
  }
}