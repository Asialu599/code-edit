import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'

type MonacoApi = typeof Monaco

export function registerEnhancedJavaLanguage(monaco: MonacoApi): void {
  monaco.languages.setMonarchTokensProvider('java', {
    defaultToken: 'identifier',
    tokenPostfix: '.java',
    ignoreCase: false,
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
      { open: '<', close: '>', token: 'delimiter.angle' },
    ],
    controlKeywords: [
      'if', 'else', 'switch', 'case', 'default', 'for', 'while', 'do', 'break',
      'continue', 'return', 'throw', 'throws', 'try', 'catch', 'finally', 'yield',
    ],
    declarationKeywords: [
      'class', 'interface', 'enum', 'record', 'extends', 'implements', 'package',
      'import', 'new', 'instanceof', 'permits',
    ],
    modifierKeywords: [
      'public', 'private', 'protected', 'static', 'final', 'abstract', 'native',
      'synchronized', 'transient', 'volatile', 'strictfp', 'sealed', 'non-sealed',
    ],
    primitiveTypes: [
      'void', 'boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double',
    ],
    constants: ['true', 'false', 'null'],
    predefined: ['this', 'super'],
    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++',
      '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '>>>', '+=', '-=',
      '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>=', '->', '::',
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[btnfr"'\\]|u[0-9A-Fa-f]{4})/,
    digits: /\d+(_+\d+)*/,
    tokenizer: {
      root: [
        [/[a-zA-Z_$][\w$]*(?=\s*\()/, {
          cases: {
            '@controlKeywords': 'keyword.control',
            '@declarationKeywords': 'keyword.declaration',
            '@modifierKeywords': 'keyword.modifier',
            '@primitiveTypes': 'type.primitive',
            '@constants': 'constant.language',
            '@predefined': 'variable.predefined',
            '@default': 'function.call',
          },
        }],
        [/[A-Z][\w$]*(?=\s*[<\[]?)/, 'type.identifier'],
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@controlKeywords': 'keyword.control',
            '@declarationKeywords': 'keyword.declaration',
            '@modifierKeywords': 'keyword.modifier',
            '@primitiveTypes': 'type.primitive',
            '@constants': 'constant.language',
            '@predefined': 'variable.predefined',
            '@default': 'identifier',
          },
        }],
        { include: '@whitespace' },
        [/@[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*/, 'annotation'],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, 'delimiter.angle'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': 'delimiter',
          },
        }],
        [/(@digits)[eE]([\-+]?(@digits))?[fFdD]?/, 'number.float'],
        [/(@digits)\.(@digits)([eE][\-+]?(@digits))?[fFdD]?/, 'number.float'],
        [/0[xX][0-9a-fA-F_]+[Ll]?/, 'number.hex'],
        [/0[bB][0-1_]+[Ll]?/, 'number.binary'],
        [/(@digits)[fFdD]/, 'number.float'],
        [/(@digits)[lL]?/, 'number'],
        [/[;,.]/, 'delimiter'],
        [/"""/, 'string.block', '@textBlock'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'[^\\']'/, 'string.char'],
        [/(')(@escapes)(')/, ['string.char', 'string.escape', 'string.char']],
        [/'/, 'string.invalid'],
      ],
      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/\/\*\*(?!\/)/, 'comment.doc', '@javadoc'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment'],
      ],
      javadoc: [
        [/@[a-zA-Z]+/, 'comment.doc.tag'],
        [/[^\/*@]+/, 'comment.doc'],
        [/\*\//, 'comment.doc', '@pop'],
        [/[\/*@]/, 'comment.doc'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],
      textBlock: [
        [/[^"]+/, 'string.block'],
        [/"""/, 'string.block', '@pop'],
        [/"/, 'string.block'],
      ],
    },
  })
}
