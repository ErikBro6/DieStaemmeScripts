export const LOG_NS = '[DS-Tools]';
export const log = {
  info: (...a:any[]) => console.info(LOG_NS, ...a),
  warn: (...a:any[]) => console.warn(LOG_NS, ...a),
  error: (...a:any[]) => console.error(LOG_NS, ...a)
};
