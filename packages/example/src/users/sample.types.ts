/** Types generated for queries found in "src/users/sample.ts" */

/** 'GetUsersWithComments' parameters type */
export interface IGetUsersWithCommentsParams {
  minCommentCount: number;
}

/** 'GetUsersWithComments' return type */
export interface IGetUsersWithCommentsResult {
  /** Age (in years) */
  age: number | null;
  email: string | null;
  first_name: string | null;
  id: number | null;
  last_name: string | null;
  registration_date: string | null;
  user_name: string | null;
}

/** 'GetUsersWithComments' query type */
export interface IGetUsersWithCommentsQuery {
  params: IGetUsersWithCommentsParams;
  result: IGetUsersWithCommentsResult;
}

/** 'SelectExistsQuery' parameters type */
export type ISelectExistsQueryParams = void;

/** 'SelectExistsQuery' return type */
export interface ISelectExistsQueryResult {
  isTransactionExists: boolean | null;
}

/** 'SelectExistsQuery' query type */
export interface ISelectExistsQueryQuery {
  params: ISelectExistsQueryParams;
  result: ISelectExistsQueryResult;
}

