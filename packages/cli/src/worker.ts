import fs from 'fs-extra';
import nun from 'nunjucks';
import path from 'path';
import worker from 'piscina';

import { PGlite } from '@electric-sql/pglite';
import { adminpack } from '@electric-sql/pglite/contrib/adminpack';
import { amcheck } from '@electric-sql/pglite/contrib/amcheck';
import { auto_explain } from '@electric-sql/pglite/contrib/auto_explain';
import { bloom } from '@electric-sql/pglite/contrib/bloom';
import { btree_gin } from '@electric-sql/pglite/contrib/btree_gin';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { cube } from '@electric-sql/pglite/contrib/cube';
import { earthdistance } from '@electric-sql/pglite/contrib/earthdistance';
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch';
import { hstore } from '@electric-sql/pglite/contrib/hstore';
import { isn } from '@electric-sql/pglite/contrib/isn';
import { lo } from '@electric-sql/pglite/contrib/lo';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { seg } from '@electric-sql/pglite/contrib/seg';
import { tablefunc } from '@electric-sql/pglite/contrib/tablefunc';
import { tcn } from '@electric-sql/pglite/contrib/tcn';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { tsm_system_time } from '@electric-sql/pglite/contrib/tsm_system_time';
import { tsm_system_rows } from '@electric-sql/pglite/contrib/tsm_system_rows';

import { ParsedConfig, TransformConfig } from './config.js';
import {
  generateDeclarationFile,
  generateTypedecsFromFile,
} from './generator.js';
import { TypeAllocator, TypeMapping, TypeScope } from './types.js';


// disable autoescape as it breaks windows paths
// see https://github.com/adelsz/pgtyped/issues/519 for details
nun.configure({ autoescape: false });

let connected = false;
const config: ParsedConfig = worker.workerData;

interface ExtendedParsedPath extends path.ParsedPath {
  dir_base: string;
}

export type IWorkerResult =
  | {
      skipped: boolean;
      typeDecsLength: number;
      relativePath: string;
    }
  | {
      error: any;
      relativePath: string;
    };

async function connectAndGetFileContents(fileName: string) {
  if (!connected) {
    connected = true;
  }

  // last part fixes https://github.com/adelsz/pgtyped/issues/390
  return fs.readFileSync(fileName).toString().replace(/\r\n/g, '\n');
}

export async function getTypeDecs({
  fileName,
  transform,
}: {
  fileName: string;
  transform: TransformConfig;
}) {
  const contents = await connectAndGetFileContents(fileName);
  const types = new TypeAllocator(TypeMapping(config.typesOverrides));
  const connection = new PGlite('memory://', {
    extensions: {
      adminpack,
      amcheck,
      auto_explain,
      bloom,
      btree_gin,
      btree_gist,
      citext,
      cube,
      earthdistance,
      fuzzystrmatch,
      hstore,
      isn,
      lo,
      ltree,
      pg_trgm,
      seg,
      tablefunc,
      tcn,
      uuid_ossp,
      tsm_system_time,
      tsm_system_rows,
    }
  });
  await connection.query('select 1');
  await connection.exec(fs.readFileSync(config.migrationsFile).toString());
  
  if (transform.mode === 'sql') {
    // Second parameter has no effect here, we could have used any value
    types.use(
      { name: 'PreparedQuery', from: '@pgtyped-lite/runtime' },
      TypeScope.Return,
    );

    types.use(
      { name: 'PreparedQueryFirst', from: '@pgtyped-lite/runtime' },
      TypeScope.Return,
    );

    types.use(
      { name: 'IDatabaseConnection', from: '@pgtyped-lite/runtime' },
      TypeScope.Return,
    );
  }
  return await generateTypedecsFromFile(
    contents,
    fileName,
    connection,
    transform,
    types,
    config,
  );
}

export type getTypeDecsFnResult = ReturnType<typeof getTypeDecs>;

export async function processFile({
  fileName,
  transform,
}: {
  fileName: string;
  transform: TransformConfig;
}): Promise<IWorkerResult> {
  const ppath = path.parse(fileName) as ExtendedParsedPath;
  ppath.dir_base = path.basename(ppath.dir);
  let decsFileName;
  if ('emitTemplate' in transform && transform.emitTemplate) {
    decsFileName = nun.renderString(transform.emitTemplate, ppath);
  } else {
    const suffix = transform.mode === 'ts' ? 'types.ts' : 'ts';
    decsFileName = path.resolve(ppath.dir, `${ppath.name}.${suffix}`);
  }

  let typeDecSet;
  try {
    typeDecSet = await getTypeDecs({ fileName, transform });
  } catch (e) {
    return {
      error: e,
      relativePath: path.relative(process.cwd(), fileName),
    };
  }
  const relativePath = path.relative(process.cwd(), decsFileName);

  if (typeDecSet.typedQueries.length > 0) {
    const declarationFileContents = await generateDeclarationFile(typeDecSet);
    const oldDeclarationFileContents = (await fs.pathExists(decsFileName))
      ? await fs.readFile(decsFileName, { encoding: 'utf-8' })
      : null;
    if (oldDeclarationFileContents !== declarationFileContents) {
      await fs.outputFile(decsFileName, declarationFileContents);
      return {
        skipped: false,
        typeDecsLength: typeDecSet.typedQueries.length,
        relativePath,
      };
    }
  }
  return {
    skipped: true,
    typeDecsLength: 0,
    relativePath,
  };
}

export type processFileFnResult = ReturnType<typeof processFile>;
