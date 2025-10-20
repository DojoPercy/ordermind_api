export function extractErrorInfo(error: unknown): {
  message: string;
  stack?: string | undefined;
} {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return { message: String((error as any).message) };
  }
  return { message: JSON.stringify(error) };
}
