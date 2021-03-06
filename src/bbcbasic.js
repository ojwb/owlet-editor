import {languages} from 'monaco-editor/esm/vs/editor/editor.api';
import {tokens} from './tokens';

function escape(token) {
    return token.replace("$", "\\$").replace("(", "\\(");
}

export const allTokensRegex = tokens
    .filter(x => x)
    .map(escape)
    .sort((x, y) => y.length - x.length)
    .join("|");

function findAllPrefixes() {
    const prefixes = new Set();
    for (const token of tokens.filter(x => x)) {
        for (let i = 0; i < token.length; ++i)
            prefixes.add(token.substr(0, i));
    }
    const result = [];
    for (const prefix of prefixes)
        result.push(prefix + '.');
    return result;
}

export function registerBbcBasicLanguage() {
    languages.register({id: 'BBCBASIC'});

    // Register a tokens provider for the language
    languages.setMonarchTokensProvider('BBCBASIC', {
        defaultToken: 'invalid',
        brackets: [
            ['(', ')', 'delimiter.parenthesis'],
        ],
        operators: [
            '+', '-', '*', '/', '<<', '>>', '^', '=', '==', '<>', '!=', '<', '>', '<=', '>=',
            '$', '?', ';', ',', '~', '!', '\''
        ],
        tokenPrefix: findAllPrefixes(),
        symbols: /[-+#=><!*/{}:?$;,~^']+/,
        tokenizer: {
            root: [
                [/(\bREM|\xf4)$/, {token: 'keyword'}], // A REM on its own line
                [/(\bREM|\xf4)/, {token: 'keyword', next: '@remStatement'}], // A REM consumes to EOL
                // This is slower than using the "tokens" built in to monarch but
                // doesn't require whitespace delimited tokens.
                [allTokensRegex, 'keyword'],
                [/[A-Z]+\./, {cases: {'@tokenPrefix': 'keyword'}}],
                [/[a-zA-Z_][\w]*[$%]?/, 'variable'],
                [/^\s*\d+/, 'enum'], // line numbers
                // whitespace
                {include: '@whitespace'},
                {include: '@common'},
                ['\\[', {token: 'delimiter.square', next: '@asm'}]
            ],
            common: [
                // immediate
                ['@symbols', {cases: {'@operators': 'operator', '@default': 'symbol'}}],
                // numbers
                [/\d*\.\d*(E[-+]?\d+)?/, 'number.float'],
                [/\d+E[-+]?\d+/, 'number.float'],
                [/\d+/, 'number'],
                [/&[0-9A-F]+/, 'number.hex'],
                [/[{}()]/, '@brackets'],
                // strings
                [/["\u201c\u201d]/, {token: 'string.quote', next: '@string'}],
                // Unusual cases. We treat @% as a regular variable (see #28).
                ['@%', 'variable'],
            ],
            whitespace: [
                [/[ \t\r\n]+/, 'white'],
            ],
            string: [
                [/[^"\u201c\u201d]+/, 'string'],
                [/["\u201c\u201d]C?/, {token: 'string.quote', next: '@pop'}]
            ],
            remStatement: [[/.*/, 'comment', '@pop']],
            asm: [
                // Not exactly working properly yet...but a start
                [/[a-zA-Z]{3}/, 'keyword'],
                [/[ \t\r\n]+/, 'white'],
                [/[;\\].*/, 'comment'],
                {include: '@common'},
                [/,\s*[XY]/, 'keyword'],
                // labels
                [/\.[a-zA-Z_$][\w$]*/, 'type.identifier'],
                [']', {token: 'delimiter.square', next: '@pop'}]
            ]
        }
    });

    // Register a completion item provider for the new language
    const uniqueTokens = [...new Set(tokens.filter(x => x))];
    languages.registerCompletionItemProvider('BBCBASIC', {
        provideCompletionItems: (model, position) => {
            const linePrefix = model.getLineContent(position.lineNumber).substr(0, position.column);
            // Does it look like a hex constant? If so, don't try to autocomplete
            if (linePrefix.match(/&[0-9A-F]*$/)) {
                return null;
            }
            return {
                suggestions: uniqueTokens.map(token => ({
                    label: token,
                    kind: languages.CompletionItemKind.Keyword,
                    insertText: token
                }))
            };
        }
    });

    languages.setLanguageConfiguration('BBCBASIC', {
        comments: {
            blockComment: ['REM', ':'], lineComment: 'REM'
        },
        brackets: [
            ['[', ']'],
            ['(', ')']
        ],
        autoClosingPairs: [
            {open: '(', close: ')'},
            {open: '"', close: '"', notIn: ['string']}
        ],
        surroundingPairs: [
            {open: '(', close: ')'},
            {open: '"', close: '"'}
        ],
        // In order to separate 10PRINT into "10" "PRINT" and
        // PRINTLN12 into "PRINT" "LN" "12", we override the default word pattern.
        wordPattern: new RegExp(
            allTokensRegex + "|" + (/(-?\d*\.\d+)|(-?\d+)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g).source)
    });

    // With thanks to https://stackoverflow.com/questions/57994101/show-quick-fix-for-an-error-in-monaco-editor
    languages.registerCodeActionProvider('BBCBASIC', {
        provideCodeActions(model, range, context) {
            const actions = context.markers.map(marker => {
                const text = model.getValueInRange(marker);
                return {
                    title: `Replace with ${text.toUpperCase()}`,
                    diagnostics: [marker],
                    kind: 'quickfix',
                    edit: {
                        edits: [
                            {
                                resource: model.uri,
                                edit: {range: marker, text: text.toUpperCase()}
                            }
                        ]
                    },
                    isPreferred: true
                };
            });
            return {
                actions: actions,
                dispose: () => {
                }
            };
        }
    });
}
