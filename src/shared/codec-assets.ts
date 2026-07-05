/**
 * Copyright 2026 App Contributors.
 * Licensed under the Apache License, Version 2.0.
 */

export type CodecAssetCodec =
  | 'avif'
  | 'hqx'
  | 'imagequant'
  | 'jxl'
  | 'mozjpeg'
  | 'oxipng'
  | 'qoi'
  | 'resize'
  | 'rotate'
  | 'webp';

export type CodecAssetRole =
  | 'decoder'
  | 'encoder'
  | 'processor'
  | 'preprocessor'
  | 'worker-helper';

export type CodecAssetVariant =
  | 'baseline'
  | 'default'
  | 'hqx'
  | 'simd'
  | 'single-thread'
  | 'multi-thread';

export type CodecAssetCache = 'precache' | 'runtime' | 'threaded-only';

export interface CodecAssetRecord {
  logicalKey: string;
  codec: CodecAssetCodec;
  role: CodecAssetRole;
  variant: CodecAssetVariant;
  url: string;
  cache: CodecAssetCache;
}

export function getPrecacheCodecAssetRecords<
  RecordType extends CodecAssetRecord,
>(records: readonly RecordType[]): RecordType[] {
  return records.filter((record) => record.cache === 'precache');
}

export function getCodecAssetUrls(
  records: readonly CodecAssetRecord[],
): string[] {
  return [...new Set(records.map((record) => record.url))];
}

export function getPrecacheCodecAssetUrls(
  records: readonly CodecAssetRecord[],
): string[] {
  return getCodecAssetUrls(getPrecacheCodecAssetRecords(records));
}

export function getCodecAssetUrlMap(
  records: readonly CodecAssetRecord[],
): Readonly<Record<string, string>> {
  const urlsByLogicalKey: Record<string, string> = {};

  for (const record of records) {
    if (urlsByLogicalKey[record.logicalKey] !== undefined) {
      throw new Error(
        `Duplicate codec asset logical key: ${record.logicalKey}`,
      );
    }

    urlsByLogicalKey[record.logicalKey] = record.url;
  }

  return urlsByLogicalKey;
}

export function getCodecAssetUrl(
  records: readonly CodecAssetRecord[],
  logicalKey: string,
): string {
  const record = records.find((item) => item.logicalKey === logicalKey);

  if (!record) {
    throw new Error(`Missing codec asset logical key: ${logicalKey}`);
  }

  return record.url;
}
