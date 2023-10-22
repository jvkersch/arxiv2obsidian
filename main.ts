import { Modal, Notice, Plugin, Setting } from "obsidian";
import axios from "axios";
import xml2js from "xml2js";
import { promisify } from "util";


// TODO Make this into an configurable option in the plugin settings
// TODO Use nunjucks or similar
const TEMPLATE = `
Title:: {{title}}
Authors:: {{authors}}
Summary:: {{summary}}
arXiv URL:: {{url}}`;


export default class Arxiv2ObsidianPlugin extends Plugin {
    async onload() {
        console.debug("loading plugin arxiv2obsidian");

        this.addCommand({
            id: "import-paper-metadata",
            name: "Import paper metadata into current note",
            editorCallback: async (editor, ctx) => {
                const modal = new ArxivImportModal(this.app);
                let arxivUrl = await modal.open();
                if (arxivUrl != "") {
                    try {
                        const metadata = await this.retrieveMetadata(arxivUrl);                
                        editor.replaceRange(
                            this.formatMetadata(metadata),
                            editor.getCursor());
                    }
                    catch (error) {
                        new Notice(`Could not import metadata from URL ${arxivUrl}`);
                    }
                }
            },
        });
    }

    async onunload() {
        console.debug("unloading plugin arxiv2obsidian");
    }

    async retrieveMetadata(arxivUrl) {

        const arxivId = arxivUrl.split('/').pop();
        const apiUrl = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
        
        const response = await axios.get(apiUrl);
        const result = await parseStringPromise(response.data)
    
        const entry = result.feed.entry[0];
        const title = reflow(entry.title[0]);
        const authors = entry.author.map(a => a.name[0]).join(', ');
        const summary = reflow(entry.summary[0]);

        return {
            title: title,
            authors: authors,
            summary: summary,
            url: arxivUrl
        };
    }

    formatMetadata(metadata): string {
        return formatObjectWithTemplate(metadata, TEMPLATE);
    }
}

export class ArxivImportModal extends Modal {
    text: string;
    resolve: ((value: string | PromiseLike<string>) => void) | null = null;

    open(): Promise<string> {
        super.open();
        return new Promise(
            resolve => {this.resolve = resolve}
        );
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h1", { text: "What paper do you want to import?" });

        new Setting(contentEl)
            .setName("arXiv URL")
            .addText((text) =>
                text.onChange((value) => {
                    this.text = value
                }));

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Submit")
                    .setCta()
                    .onClick(() => {
                        this.resolve!(this.text);
                        this.close();
                    }));
    }

    onClose() {
        const { contentEl } = this;
        this.resolve!("");
        contentEl.empty();
    }
}

// General-purpose utilities

function formatObjectWithTemplate(obj, template) {
    // Replace each placeholder with its corresponding value from the object
    for (let key in obj) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, obj[key]);
    }
    return template;
}

function reflow(s) {
    // Replace single newlines with spaces, but keep multiple newlines (paragraph breaks).
    return s.replace(/([^\n])\n([^\n])/g, '$1 $2');
}

const parseStringPromise = promisify(xml2js.parseString);
