import $ from 'jquery';
import {editor as monacoEditor, KeyMod, KeyCode} from 'monaco-editor';
import {registerBbcBasicLanguage} from './bbcbasic';
import {Emulator} from './emulator';
import rootHtml from './root.html';

import './owlet-editor.less';

let owletEditor = null;

const DefaultProgram = [
    'PRINT "HELLO WORLD"',
    'GOTO 10'
].join('\n');

class OwletEditor {
    constructor() {
        const editorPane = document.getElementById('editor');
        const remaining = document.getElementById('remaining');
        this.observer = new ResizeObserver(() => this.editor.layout());
        this.observer.observe(editorPane.parentElement)
        this.editor = monacoEditor.create(editorPane, {
            value: localStorage.getItem("program") || DefaultProgram,
            minimap: {
                enabled: false
            },
            lineNumbers: l => l * 10,
            language: 'BBCBASIC',
            theme: 'vs-dark',
            renderWhitespace: "none", // seems to fix odd space/font interaction
            fontSize: 16,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineDecorationsWidth: 0
        });

        this.editor.addAction({
            id: 'execute-basic',
            label: 'Run',
            keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
            keybindingContext: null,
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            run: async () => await this.emulator.runProgram(this.editor.getModel().getValue()),
        });

        this.editor.getModel().onDidChangeContent(() => {
            const editorBuffer = this.editor.getModel().getValue();
            localStorage.setItem("program", editorBuffer);
            remaining.innerHTML = editorBuffer.length + " / " + (280-editorBuffer.length);
        });
        this.emulator = new Emulator($('#emulator'));
    }

    async updateProgram() {
        await this.emulator.runProgram(this.editor.getModel().getValue());
    }

    selectView(selected) {
              for ( var element of ['screen','about','examples']) {
                document.getElementById(element).style.display = (element == selected) ? 'block' : 'none';
              }
    }

    async initialise() {

        await this.emulator.initialise();
        await this.updateProgram();
        const actions = {
            run: async () => {this.updateProgram();this.selectView('screen')},
            pause: async () => {this.emulator.pause();this.selectView('screen')},
            resume: async () => {this.emulator.start();this.selectView('screen')},
            examples: async () => {this.selectView('examples');this.emulator.pause();},
            emulator: async () => {this.selectView('screen');this.emulator.start();},
            about: async () => {this.selectView('about');this.emulator.pause();}
        };
        $(".toolbar button").click(e => actions[e.target.dataset.action]());
    }
}

async function initialise() {
    $('body').append(rootHtml);
    registerBbcBasicLanguage();

    owletEditor = new OwletEditor();
    await owletEditor.initialise();

    function setTheme(themeName) {
      localStorage.setItem('theme', themeName);
      document.documentElement.className = themeName;
    }
    setTheme("theme-beeb-dark");
}

initialise().then(() => {
    console.log("Ready to go");
});
