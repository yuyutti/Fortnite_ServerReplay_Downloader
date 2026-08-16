declare module 'fortnite-serverreplay-downloader';

interface Checkpoint {
  Id: string,
  Group: string,
  Metadata: string,
  Time1: number,
  Time2: number,
  DownloadLink?: string,
  FileSize: number,
}

interface Event {
  Id: string,
  Group: string,
  Metadata: string,
  Time1: number,
  Time2: number,
  DownloadLink?: string,
  FileSize: number,
}

interface DataChunk {
  Id: string,
  Time1: number,
  Time2: number,
  SizeInBytes: number,
  DownloadLink?: string,
  FileSize: number,
}

interface MetaDataResult {
  ReplayName: string,
  LengthInMS: number,
  NetworkVersion: number,
  Changelist: number,
  FriendlyName: string,
  Timestamp: string,
  bIsLive: boolean,
  bCompressed: boolean,
  DesiredDelayInSeconds: number,
  DownloadLink?: string,
  FileSize: number,
  Checkpoints: Checkpoint[],
  Events: Event[],
  DataChunks: DataChunk[],
}

interface MetaDataOptions {
  matchId: string,
  chunkDownloadLinks: boolean,
  debugCallback?: (event: DebugEvent) => void,
}

interface UpdateInfo {
  current: number,
  max: number,
}

interface UpdateObject {
  header: UpdateInfo,
  dataChunks: UpdateInfo,
  eventChunks: UpdateInfo,
  checkpointChunks: UpdateInfo,
}

interface ReplayOptions {
  matchId: string,
  maxConcurrentDownloads?: number,
  httpClient?: 'needle' | 'fetch',
  checkpointCount?: number,
  dataCount?: number,
  eventCount?: number,
  updateCallback?: (UpdateInfo: UpdateObject) => void,
  debugCallback?: (event: DebugEvent) => void,
}

interface DebugEvent {
  timestamp: string,
  type: string,
  client?: 'needle' | 'fetch',
  requestKind?: string,
  chunkId?: string | null,
  chunkType?: number | null,
  url?: string | null,
  attempt?: number,
  maximumAttempts?: number,
  durationMs?: number,
  retryDelayMs?: number,
  bytes?: number,
  statusCode?: number | null,
  httpVersion?: string | null,
  alpnProtocol?: string | null,
  errorName?: string,
  errorMessage?: string,
  errorCode?: string | number | null,
}

interface SaveReplayOptions extends ReplayOptions {
  outputDir: string,
  fileName?: string,
}

export function downloadMetadata(options: MetaDataOptions): Promise<MetaDataResult>;

export function downloadReplay(options: ReplayOptions): Promise<Buffer>;

export function saveReplay(options: SaveReplayOptions): Promise<string>;
