import { InterpolatedQuery } from '@pgtyped-lite/runtime';
import { IParseError, IQueryTypes } from './actions.js';

export { getTypes, IParseError, IQueryTypes } from './actions.js';

export {
  isAlias,
  isEnum,
  isEnumArray,
  isImport,
  MappableType,
  Type,
  ImportedType,
} from './type.js';

export type TypeSource = (
  queryData: InterpolatedQuery,
) => Promise<IQueryTypes | IParseError>;
