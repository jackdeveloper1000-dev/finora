// One JSON object per line: easy to ship to any log aggregator. Never pass tokens, passwords or document contents.
const write = (level, message, fields) => {
  const line = `${JSON.stringify({ time: new Date().toISOString(), level, message, ...fields })}\n`;
  (level === 'error' ? process.stderr : process.stdout).write(line);
};

export const logger = {
  info: (message, fields = {}) => write('info', message, fields),
  warn: (message, fields = {}) => write('warn', message, fields),
  error: (message, fields = {}) => write('error', message, fields),
};

export const errorFields = (err) => ({ error: err?.message, code: err?.code, stack: err?.stack });
