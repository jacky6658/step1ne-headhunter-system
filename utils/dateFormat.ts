// 台灣時區時間格式化工具（UTC → UTC+8）

const TZ = 'Asia/Taipei';

/** 顯示日期：2026/02/26 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('zh-TW', { timeZone: TZ });
}

/** 顯示日期時間：2026/02/26 20:51 */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-TW', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/** 顯示月日時分：02/26 20:51 */
export function fmtShortDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-TW', {
    timeZone: TZ,
    hour12: false,
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
