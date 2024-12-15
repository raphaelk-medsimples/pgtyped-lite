/** @fileoverview Config file parser */

import { Type } from '@pgtyped-lite/query';
import * as Either from 'fp-ts/lib/Either.js';
import * as t from 'io-ts';
import { reporter } from 'io-ts-reporters';
import { createRequire } from 'module';
import { isAbsolute, join } from 'path';
import tls from 'tls';
import { DatabaseConfig, default as dbUrlModule } from 'ts-parse-database-url';
import { TypeDefinition } from './types.js';

// module import hack
const { default: parseDatabaseUri } = dbUrlModule as any;

const transformCodecProps = {
  include: t.string,
  /** @deprecated emitFileName is deprecated */
  emitFileName: t.union([t.string, t.undefined]),
  emitTemplate: t.union([t.string, t.undefined]),
};

const TSTransformCodec = t.type({
  mode: t.literal('ts'),
  ...transformCodecProps,
});

const TSTypedSQLTagTransformCodec = t.type({
  mode: t.literal('ts-implicit'),
  include: t.string,
  functionName: t.string,
  emitFileName: t.string,
});

export type TSTypedSQLTagTransformConfig = t.TypeOf<
  typeof TSTypedSQLTagTransformCodec
>;

const SQLTransformCodec = t.type({
  mode: t.literal('sql'),
  ...transformCodecProps,
});

const TransformCodec = t.union([
  TSTransformCodec,
  SQLTransformCodec,
  TSTypedSQLTagTransformCodec,
]);

export type TransformConfig = t.TypeOf<typeof TransformCodec>;

const configParser = t.type({
  // maximum number of worker threads to use for the codegen worker pool
  maxWorkerThreads: t.union([t.number, t.undefined]),
  transforms: t.array(TransformCodec),
  srcDir: t.string,
  failOnError: t.union([t.boolean, t.undefined]),
  camelCaseColumnNames: t.union([t.boolean, t.undefined]),
  hungarianNotation: t.union([t.boolean, t.undefined]),
  migrationsFile: t.string,
  typesOverrides: t.union([
    t.record(
      t.string,
      t.union([
        t.string,
        t.type({
          parameter: t.union([t.string, t.undefined]),
          return: t.union([t.string, t.undefined]),
        }),
      ]),
    ),
    t.undefined,
  ]),
});

export type IConfig = typeof configParser._O;

export interface ParsedConfig {
  maxWorkerThreads: number | undefined;
  failOnError: boolean;
  camelCaseColumnNames: boolean;
  hungarianNotation: boolean;
  transforms: IConfig['transforms'];
  srcDir: IConfig['srcDir'];
  typesOverrides: Record<string, Partial<TypeDefinition>>;
  migrationsFile: IConfig['migrationsFile'];
}

function merge<T>(base: T, ...overrides: Partial<T>[]): T {
  return overrides.reduce<T>(
    (acc, o) =>
      Object.entries(o).reduce(
        (oAcc, [k, v]) => (v ? { ...oAcc, [k]: v } : oAcc),
        acc,
      ),
    { ...base },
  );
}

function convertParsedURLToDBConfig({
  host,
  password,
  user,
  port,
  database,
}: DatabaseConfig) {
  return {
    host,
    password,
    user,
    port,
    dbName: database,
  };
}

const require = createRequire(import.meta.url);

export function stringToType(str: string): Type {
  if (
    str.startsWith('./') ||
    str.startsWith('../') ||
    str.includes('#') ||
    str.includes(' as ')
  ) {
    const [firstSection, alias] = str.split(' as ');
    const [from, namedImport] = firstSection.split('#');

    if (!alias && !namedImport) {
      throw new Error(
        `Relative import "${str}" should have an alias if you want to import default (eg. "${str} as MyAlias") or have a named import (eg. "${str}#MyType")`,
      );
    }

    return {
      name: alias ?? namedImport,
      from,
      aliasOf: alias ? namedImport ?? 'default' : undefined,
    };
  }

  return { name: str };
}

export function parseConfig(
  path: string,
): ParsedConfig {
  const fullPath = isAbsolute(path) ? path : join(process.cwd(), path);
  const configObject = require(fullPath);

  const result = configParser.decode(configObject);
  if (Either.isLeft(result)) {
    const message = reporter(result);
    throw new Error(message[0]);
  }

  const {
    maxWorkerThreads,
    transforms,
    srcDir,
    failOnError,
    camelCaseColumnNames,
    hungarianNotation,
    typesOverrides,
    migrationsFile,
  } = configObject as IConfig;

  if (transforms.some((tr) => tr.mode !== 'ts-implicit' && !!tr.emitFileName)) {
    // tslint:disable:no-console
    console.log(
      'Warning: Setting "emitFileName" is deprecated. Consider using "emitTemplate" instead.',
    );
  }

  const parsedTypesOverrides: Record<string, Partial<TypeDefinition>> = {};

  for (const [typeName, mappedTo] of Object.entries(typesOverrides ?? {})) {
    if (typeof mappedTo === 'string') {
      parsedTypesOverrides[typeName] = {
        parameter: stringToType(mappedTo),
        return: stringToType(mappedTo),
      };
    } else {
      parsedTypesOverrides[typeName] = {
        parameter: mappedTo.parameter
          ? stringToType(mappedTo.parameter)
          : undefined,
        return: mappedTo.return ? stringToType(mappedTo.return) : undefined,
      };
    }
  }

  return {
    transforms,
    srcDir,
    failOnError: failOnError ?? false,
    camelCaseColumnNames: camelCaseColumnNames ?? false,
    hungarianNotation: hungarianNotation ?? true,
    typesOverrides: parsedTypesOverrides,
    maxWorkerThreads,
    migrationsFile,
  };
}
