import { Injectable } from '@nestjs/common';

import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export interface CursorFields {
  id: string;
  [key: string]: any; // Additional fields like createdAt
}

@Injectable()
export class PaginationService {
  private getItem<T>(arr: T[], index: number): T {
    if (index < 0 || index >= arr.length) {
      throw new Error('Index out of bounds');
    }
    const value = arr[index];
    if (value === undefined) {
      throw new Error('Unexpected undefined array element');
    }
    return value;
  }
  /**
   * Encode cursor to base64
   */
  encodeCursor(fields: CursorFields): string {
    const jsonString = JSON.stringify(fields);
    return Buffer.from(jsonString).toString('base64');
  }

  /**
   * Decode cursor from base64
   */
  decodeCursor(cursor: string): CursorFields | null {
    try {
      const jsonString = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  /**
   * Build paginated response with metadata
   */
  buildPaginatedResponse<T extends Record<string, unknown>>(
    items: T[],
    limit: number,
    cursorField: keyof T = 'id' as keyof T,
    additionalCursorFields: (keyof T)[] = [],
  ): PaginatedResponse<T> {
    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, -1) : items;

    let startCursor: string | undefined;
    let endCursor: string | undefined;
    if (data.length > 0) {
      const firstItem = this.getItem(data, 0);
      const lastItem = this.getItem(data, data.length - 1);
      startCursor = this.encodeCursor(
        this.extractCursorFields(
          firstItem,
          cursorField,
          additionalCursorFields,
        ),
      );
      endCursor = this.encodeCursor(
        this.extractCursorFields(lastItem, cursorField, additionalCursorFields),
      );
    }

    return {
      data,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: false, // Can be enhanced for bidirectional pagination
        startCursor,
        endCursor,
      },
    };
  }

  private extractCursorFields<T extends Record<string, unknown>>(
    item: T,
    cursorField: keyof T,
    additionalFields: (keyof T)[],
  ): CursorFields {
    const idValue = item[cursorField];
    const fields: CursorFields = {
      id: String(idValue ?? ''),
    };

    additionalFields.forEach((field) => {
      fields[String(field)] = item[field] ?? null;
    });

    return fields;
  }
}
