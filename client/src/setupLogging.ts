type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const envLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined)?.toLowerCase() as LogLevel;
const configuredLevel: LogLevel = envLevel && levelWeights[envLevel] !== undefined
  ? envLevel
  : (import.meta.env.DEV ? 'info' : 'warn');

if (typeof console.clear === 'function' && import.meta.env.VITE_CLEAR_CONSOLE !== 'false') {
  console.clear();
}

const methodLevels: Array<{ method: keyof Console; level: LogLevel }> = [
  { method: 'debug', level: 'debug' },
  { method: 'log', level: 'info' },
  { method: 'info', level: 'info' },
  { method: 'warn', level: 'warn' },
  { method: 'error', level: 'error' },
];

const noop = (..._args: unknown[]) => {};

methodLevels.forEach(({ method, level }) => {
  if (levelWeights[level] < levelWeights[configuredLevel]) {
    (console[method] as any) = noop;
  }
});
