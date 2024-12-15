/** Types generated for queries found in "src/users/sample.ts" */

/** 'GetUsersWithComments' parameters type */
export interface IGetUsersWithCommentsParams {
  minCommentCount: number;
}

/** 'GetUsersWithComments' return type */
export interface IGetUsersWithCommentsResult {
  /** Age (in years) */
  age: number;
  email: string;
  firstName: string;
  id: number;
  lastName: string;
  registrationDate: string;
  userName: string;
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
  isTransactionExists: boolean;
}

/** 'SelectExistsQuery' query type */
export interface ISelectExistsQueryQuery {
  params: ISelectExistsQueryParams;
  result: ISelectExistsQueryResult;
}

