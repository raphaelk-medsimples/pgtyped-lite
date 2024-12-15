/** Types generated for queries found in "src/comments/comments.sql" */
import { PreparedQuery, PreparedQueryFirst, IDatabaseConnection } from '@pgtyped-lite/runtime';

/** 'GetAllComments' parameters type */
export interface IGetAllCommentsParams {
  id: number;
}

/** 'GetAllComments' return type */
export interface IGetAllCommentsResult {
  body: string;
  bookId: number;
  id: number;
  userId: number;
}

/** 'GetAllComments' query type */
export interface IGetAllCommentsQuery {
  params: IGetAllCommentsParams;
  result: IGetAllCommentsResult;
}

const getAllCommentsIR: any = {"name":"GetAllComments","usedParamSet":{"id":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":39,"b":42},{"a":57,"b":59}]}],"statement":"SELECT * FROM book_comments WHERE id = :id! OR user_id = :id"};

/**
 * Query generated from SQL:
 * ```
 * SELECT * FROM book_comments WHERE id = :id! OR user_id = :id
 * ```
 */
export const getAllComments = new PreparedQuery<IGetAllCommentsParams,IGetAllCommentsResult>(getAllCommentsIR);


/** 'GetAllCommentsFirst' parameters type */
export interface IGetAllCommentsFirstParams {
  id: number;
}

/** 'GetAllCommentsFirst' return type */
export interface IGetAllCommentsFirstResult {
  body: string;
  bookId: number;
  id: number;
  userId: number;
}

/** 'GetAllCommentsFirst' query type */
export interface IGetAllCommentsFirstQuery {
  params: IGetAllCommentsFirstParams;
  result: IGetAllCommentsFirstResult;
}

const getAllCommentsFirstIR: any = {"name":"GetAllCommentsFirst","usedParamSet":{"id":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":39,"b":42},{"a":57,"b":59}]}],"statement":"SELECT * FROM book_comments WHERE id = :id! OR user_id = :id                                      "};

/**
 * Query generated from SQL:
 * ```
 * SELECT * FROM book_comments WHERE id = :id! OR user_id = :id                                      
 * ```
 */
export const getAllCommentsFirst = new PreparedQueryFirst<IGetAllCommentsFirstParams,IGetAllCommentsFirstResult>(getAllCommentsFirstIR);


/** 'GetAllCommentsByIds' parameters type */
export interface IGetAllCommentsByIdsParams {
  ids: readonly (number)[];
}

/** 'GetAllCommentsByIds' return type */
export interface IGetAllCommentsByIdsResult {
  body: string;
  bookId: number;
  id: number;
  userId: number;
}

/** 'GetAllCommentsByIds' query type */
export interface IGetAllCommentsByIdsQuery {
  params: IGetAllCommentsByIdsParams;
  result: IGetAllCommentsByIdsResult;
}

const getAllCommentsByIdsIR: any = {"name":"GetAllCommentsByIds","usedParamSet":{"ids":true},"params":[{"name":"ids","required":true,"transform":{"type":"array_spread"},"locs":[{"a":40,"b":43},{"a":55,"b":59}]}],"statement":"SELECT * FROM book_comments WHERE id in :ids AND id in :ids!"};

/**
 * Query generated from SQL:
 * ```
 * SELECT * FROM book_comments WHERE id in :ids AND id in :ids!
 * ```
 */
export const getAllCommentsByIds = new PreparedQuery<IGetAllCommentsByIdsParams,IGetAllCommentsByIdsResult>(getAllCommentsByIdsIR);


/** 'InsertComment' parameters type */
export interface IInsertCommentParams {
  comments: readonly ({
    userId: number,
    commentBody: string
  })[];
}

/** 'InsertComment' return type */
export interface IInsertCommentResult {
  body: string;
  bookId: number;
  id: number;
  userId: number;
}

/** 'InsertComment' query type */
export interface IInsertCommentQuery {
  params: IInsertCommentParams;
  result: IInsertCommentResult;
}

const insertCommentIR: any = {"name":"InsertComment","usedParamSet":{"comments":true},"params":[{"name":"comments","required":false,"transform":{"type":"pick_array_spread","keys":[{"name":"userId","required":true},{"name":"commentBody","required":true}]},"locs":[{"a":73,"b":81}]}],"statement":"INSERT INTO book_comments (user_id, body)\n-- NOTE: this is a note\nVALUES :comments RETURNING *"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO book_comments (user_id, body)
 * -- NOTE: this is a note
 * VALUES :comments RETURNING *
 * ```
 */
export const insertComment = new PreparedQuery<IInsertCommentParams,IInsertCommentResult>(insertCommentIR);


/** 'SelectExistsTest' parameters type */
export type ISelectExistsTestParams = void;

/** 'SelectExistsTest' return type */
export interface ISelectExistsTestResult {
  isTransactionExists: boolean;
}

/** 'SelectExistsTest' query type */
export interface ISelectExistsTestQuery {
  params: ISelectExistsTestParams;
  result: ISelectExistsTestResult;
}

const selectExistsTestIR: any = {"name":"SelectExistsTest","usedParamSet":{},"params":[],"statement":"SELECT EXISTS ( SELECT 1 WHERE true ) AS \"isTransactionExists\""};

/**
 * Query generated from SQL:
 * ```
 * SELECT EXISTS ( SELECT 1 WHERE true ) AS "isTransactionExists"
 * ```
 */
export const selectExistsTest = new PreparedQuery<ISelectExistsTestParams,ISelectExistsTestResult>(selectExistsTestIR);


export default (db: IDatabaseConnection) => ({
  getAllComments: (params: IGetAllCommentsParams) => getAllComments.run(params, db),
  getAllCommentsFirst: (params: IGetAllCommentsFirstParams) => getAllCommentsFirst.run(params, db),
  getAllCommentsByIds: (params: IGetAllCommentsByIdsParams) => getAllCommentsByIds.run(params, db),
  insertComment: (params: IInsertCommentParams) => insertComment.run(params, db),
  selectExistsTest: () => selectExistsTest.run(undefined, db),
});
