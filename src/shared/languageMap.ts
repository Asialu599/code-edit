// 文件后缀 → Monaco 语言 ID
const EXTENSION_MAP: Record<string, string> = {
  '.java': 'java', '.class': 'java', '.jar': 'java',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.html': 'html', '.htm': 'html', '.vue': 'html', '.svelte': 'html',
  '.css': 'css', '.scss': 'scss', '.less': 'less', '.sass': 'scss',
  '.json': 'json', '.jsonc': 'json', '.json5': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.xml': 'xml', '.svg': 'xml', '.rss': 'xml', '.atom': 'xml',
  '.py': 'python', '.pyw': 'python', '.ipynb': 'python',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c++': 'cpp',
  '.hpp': 'cpp', '.hxx': 'cpp', '.h++': 'cpp',
  '.cs': 'csharp', '.csx': 'csharp',
  '.go': 'go',
  '.rs': 'rust', '.rlib': 'rust',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.ps1': 'powershell', '.psm1': 'powershell', '.psd1': 'powershell',
  '.bat': 'bat', '.cmd': 'bat',
  '.sql': 'sql',
  '.md': 'markdown', '.mdx': 'markdown',
  'Dockerfile': 'dockerfile', '.dockerfile': 'dockerfile',
  '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini',
  '.toml': 'ini',
  '.lua': 'lua',
  '.r': 'r',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.dart': 'dart',
  '.scala': 'scala',
  '.pl': 'perl', '.pm': 'perl',
  '.groovy': 'groovy',
  '.jl': 'julia',
  '.hs': 'haskell',
  '.elm': 'elm',
  '.clj': 'clojure', '.cljs': 'clojure', '.edn': 'clojure',
  '.erl': 'erlang', '.hrl': 'erlang',
  '.ex': 'elixir', '.exs': 'elixir',
  '.fs': 'fsharp', '.fsi': 'fsharp', '.fsx': 'fsharp',
  '.vb': 'vb',
  '.coffee': 'coffee',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.log': 'plaintext', '.txt': 'plaintext', '.csv': 'plaintext',
  '.env': 'plaintext', '.gitignore': 'plaintext', '.editorconfig': 'plaintext',
}

export function detectLanguage(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() || ''
  if (EXTENSION_MAP[name]) return EXTENSION_MAP[name]

  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : ''
  return EXTENSION_MAP[ext] || 'plaintext'
}
