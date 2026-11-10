export type ReportFormat = 'txt' | 'log' | 'md' | 'json' | 'csv'
const formats = new Set<ReportFormat>(['txt', 'log', 'md', 'json', 'csv'])

export function parseReportFormat(filePath: string): ReportFormat | undefined {
  const extension = filePath.split('.').pop()?.toLowerCase() as ReportFormat | undefined
  return extension && formats.has(extension) ? extension : undefined
}

/** The export representation must match the extension actually chosen by the user. */
export function formatSupportContent(text: string, format: ReportFormat): string {
  const lines = text.split(/\r?\n/)
  if (format === 'txt' || format === 'log') return text
  if (format === 'json') {
    return JSON.stringify({ format: 'wirebound-report-v1', lines }, null, 2) + '\n'
  }
  if (format === 'csv') {
    const escape = (value: string): string => '"' + value.replace(/"/g, '""') + '"'
    return '\uFEFFline,message\r\n' + lines.map((line, i) => (i + 1) + ',' + escape(line)).join('\r\n') + '\r\n'
  }
  return '# Wirebound Report\n\n' + lines.map(line => '    ' + line).join('\n') + '\n'
}
