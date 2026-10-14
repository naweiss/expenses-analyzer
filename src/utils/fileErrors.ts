import type { TranslationSchema } from './translations';

export enum FileErrorCode {
  FileEmpty = 'FILE_EMPTY',
  NoValidTransactions = 'NO_VALID_TRANSACTIONS',
  MissingColumns = 'MISSING_COLUMNS',
  FailedToProcess = 'FAILED_TO_PROCESS',
  FailedToRead = 'FAILED_TO_READ',
  PasswordProtected = 'PASSWORD_PROTECTED',
  UnsupportedFormat = 'UNSUPPORTED_FORMAT',
  UnknownError = 'UNKNOWN_ERROR',
}

export interface FileErrorInfo {
  code: FileErrorCode;
  params?: Record<string, string>;
}

export class FileParsingError extends Error {
  readonly code: FileErrorCode;
  readonly params?: Record<string, string>;

  constructor(code: FileErrorCode, params?: Record<string, string>) {
    super(code);
    this.name = 'FileParsingError';
    this.code = code;
    this.params = params;
  }
}

/**
 * Resolves a localized error message from a FileErrorInfo or legacy string,
 * interpolating any parameters (e.g. {columns}).
 */
export function getFileErrorMessage(
  error: FileErrorInfo | string | undefined,
  translation: TranslationSchema,
): string {
  if (!error) return '';
  if (typeof error === 'string') return error;

  const template = translation.fileErrors[error.code] || translation.failedToParseFile;

  if (!error.params) return template;

  let resolved = template;
  for (const [key, val] of Object.entries(error.params)) {
    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return resolved;
}
