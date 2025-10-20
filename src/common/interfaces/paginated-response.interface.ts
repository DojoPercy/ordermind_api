export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | undefined;
  endCursor?: string | undefined;
}

export interface PaginatedResponse<T> {
  data: T[];
  pageInfo: PageInfo;
  totalCount?: number;
}
